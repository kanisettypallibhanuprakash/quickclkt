
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Response,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pwdlib import PasswordHash
from sqlalchemy import (
    create_engine,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    select,
    or_,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    sessionmaker,
    Session,
)


# =========================================================
# 1. CONFIGURATION
# =========================================================

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)

password_hasher = PasswordHash.recommended()

COOKIE_NAME = "room_booking_session"
JWT_ALGORITHM = "HS256"
SESSION_HOURS = 12

HOSTELS = {"Ashwatha", "Ashoka", "Annex", "Jasmine"}


# =========================================================
# 2. DATABASE BASE AND MODELS
# =========================================================

class Base(DeclarativeBase):
    pass


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid4()),
    )
    roll_number: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(254), unique=True, index=True, nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False,
    )
    academic_year: Mapped[int] = mapped_column(
        Integer, nullable=False,
    )
    course: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )
    mobile_number: Mapped[str] = mapped_column(
        String(25), nullable=False,
    )
    hostel_name: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class RoommateInvitation(Base):
    __tablename__ = "roommate_invitations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid4()),
    )
    inviter_id: Mapped[str] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True,
    )
    invitee_id: Mapped[str] = mapped_column(
        ForeignKey("students.id"), nullable=False, index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )


class RoommateGroup(Base):
    __tablename__ = "roommate_groups"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid4()),
    )
    group_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True,
    )
    member1_id: Mapped[str] = mapped_column(
        ForeignKey("students.id"), unique=True, nullable=False,
    )
    member2_id: Mapped[str] = mapped_column(
        ForeignKey("students.id"), unique=True, nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid4()),
    )
    hostel_name: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True,
    )
    floor: Mapped[int] = mapped_column(
        Integer, nullable=False,
    )
    room_number: Mapped[int] = mapped_column(
        Integer, nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "hostel_name",
            "floor",
            "room_number",
            name="uq_hostel_floor_room",
        ),
    )


class RoomBooking(Base):
    __tablename__ = "room_bookings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid4()),
    )
    room_id: Mapped[str] = mapped_column(
        ForeignKey("rooms.id"), unique=True, nullable=False,
    )
    group_pk: Mapped[str] = mapped_column(
        ForeignKey("roommate_groups.id"), unique=True, nullable=False,
    )
    booked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =========================================================
# 3. REQUEST MODELS
# =========================================================

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    roll_number: str = Field(min_length=2, max_length=40)
    email: EmailStr
    academic_year: int = Field(ge=1, le=6)
    course: str = Field(min_length=2, max_length=100)
    mobile_number: str = Field(min_length=7, max_length=25)
    hostel_name: str | None = None
    password: str = Field(min_length=8, max_length=128)

    @field_validator("roll_number")
    @classmethod
    def normalize_roll_number(cls, value):
        return value.strip().upper()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()

    @field_validator("full_name", "course", "mobile_number")
    @classmethod
    def strip_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty.")
        return value

    @field_validator("hostel_name")
    @classmethod
    def validate_hostel(cls, value):
        if value is not None:
            value = value.strip()
            if value not in HOSTELS:
                raise ValueError("Invalid hostel name.")
        return value


class LoginRequest(BaseModel):
    roll_number: str = Field(min_length=2, max_length=40)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("roll_number")
    @classmethod
    def normalize_roll_number(cls, value):
        return value.strip().upper()


class RoommateInviteRequest(BaseModel):
    roll_number: str = Field(min_length=2, max_length=40)

    @field_validator("roll_number")
    @classmethod
    def normalize_roll_number(cls, value):
        return value.strip().upper()


class InvitationResponse(BaseModel):
    accept: bool


class PairCodeRequest(BaseModel):
    pair_code: str = Field(min_length=1, max_length=20)


class RoomBookingRequest(BaseModel):
    pair_code: str = Field(min_length=1, max_length=20)
    floor: int = Field(ge=1, le=14)
    room_number: int = Field(ge=1, le=40)


# =========================================================
# 4. DATABASE SESSION AND AUTHENTICATION HELPERS
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)

def seed_demo_students(db: Session):
    """Create or refresh the two public demo accounts safely."""
    demo_students = [
        {
            "roll_number": "DEMO001",
            "full_name": "Demo Student One",
            "email": "demo001@example.com",
            "academic_year": 2,
            "course": "B.Tech CSE",
            "mobile_number": "9000000001",
            "hostel_name": "Ashwatha",
            "password": "Demo@12345",
        },
        {
            "roll_number": "DEMO002",
            "full_name": "Demo Student Two",
            "email": "demo002@example.com",
            "academic_year": 2,
            "course": "B.Tech CSE",
            "mobile_number": "9000000002",
            "hostel_name": "Ashwatha",
            "password": "Demo@12345",
        },
    ]

    for data in demo_students:
        student = db.scalar(
            select(Student).where(Student.roll_number == data["roll_number"])
        )

        if student is None:
            email_owner = db.scalar(
                select(Student).where(Student.email == data["email"])
            )
            if email_owner is not None:
                # Avoid overwriting a different student's account.
                continue
            student = Student(
                roll_number=data["roll_number"],
                full_name=data["full_name"],
                email=data["email"],
                academic_year=data["academic_year"],
                course=data["course"],
                mobile_number=data["mobile_number"],
                hostel_name=data["hostel_name"],
                password_hash=hash_password(data["password"]),
                is_verified=True,
            )
            db.add(student)
        else:
            # Keep demo credentials usable if a previous seed was incomplete.
            student.full_name = data["full_name"]
            student.email = data["email"]
            student.academic_year = data["academic_year"]
            student.course = data["course"]
            student.mobile_number = data["mobile_number"]
            student.hostel_name = data["hostel_name"]
            student.password_hash = hash_password(data["password"])
            student.is_verified = True

    db.commit()

def verify_password(password: str, stored_hash: str) -> bool:
    return password_hasher.verify(password, stored_hash)


def create_token(student_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": student_id,
        "iat": now,
        "exp": now + timedelta(hours=SESSION_HOURS),
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_student(
    request: Request,
    db: Session = Depends(get_db),
) -> Student:
    token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Please log in first.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        student_id = payload["sub"]
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please log in again.",
        )

    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(
            status_code=401,
            detail="Student account not found.",
        )

    return student


def student_response(student: Student):
    created_at = student.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "full_name": student.full_name,
        "email": student.email,
        "academic_year": student.academic_year,
        "course": student.course,
        "mobile_number": student.mobile_number,
        "hostel_name": student.hostel_name,
        "is_verified": student.is_verified,
        "created_at": created_at.isoformat(),
    }


def set_session_cookie(response: Response, student_id: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_token(student_id),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_HOURS * 60 * 60,
        path="/",
    )


def student_summary(student: Student):
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "full_name": student.full_name,
    }


# =========================================================
# 5. ROOMMATE AND BOOKING HELPERS
# =========================================================

def find_student_group(db: Session, student_id: str):
    return db.scalar(
        select(RoommateGroup).where(
            or_(
                RoommateGroup.member1_id == student_id,
                RoommateGroup.member2_id == student_id,
            )
        )
    )


def generate_group_id(db: Session) -> str:
    for _ in range(10):
        candidate = "QCLKT-" + secrets.token_hex(4).upper()
        existing = db.scalar(
            select(RoommateGroup).where(
                RoommateGroup.group_id == candidate
            )
        )
        if existing is None:
            return candidate

    raise HTTPException(
        status_code=500,
        detail="Could not generate a group ID. Please try again.",
    )


def get_validated_roommate_group(
    db: Session,
    pair_code: str,
    current: Student,
):
    group = db.scalar(
        select(RoommateGroup).where(
            RoommateGroup.group_id == pair_code.strip().upper()
        )
    )

    if group is None:
        raise HTTPException(status_code=404, detail="Invalid pair code.")

    if current.id not in (group.member1_id, group.member2_id):
        raise HTTPException(
            status_code=403,
            detail="This pair code does not belong to your account.",
        )

    member1 = db.get(Student, group.member1_id)
    member2 = db.get(Student, group.member2_id)

    if member1 is None or member2 is None:
        raise HTTPException(
            status_code=409,
            detail="Both group members must have valid accounts.",
        )

    hostel1 = member1.hostel_name
    hostel2 = member2.hostel_name

    if not hostel1 or not hostel2:
        raise HTTPException(
            status_code=409,
            detail="Both students must have an assigned hostel.",
        )

    if hostel1 != hostel2:
        raise HTTPException(
            status_code=409,
            detail="Both students must belong to the same hostel.",
        )

    if hostel1 not in HOSTELS:
        raise HTTPException(
            status_code=409,
            detail="Unsupported hostel.",
        )

    return group, hostel1, member1, member2


# =========================================================
# 6. STARTUP: CREATE TABLES AND ROOM INVENTORY
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        seed_demo_students(db)

        # Initialize 14 floors and 40 rooms per floor per hostel.
        # Existing rooms and bookings are preserved.
        for hostel_name in sorted(HOSTELS):
            for floor in range(1, 15):
                for room_number in range(1, 41):
                    existing = db.scalar(
                        select(Room.id).where(
                            Room.hostel_name == hostel_name,
                            Room.floor == floor,
                            Room.room_number == room_number,
                        )
                    )

                    if existing is None:
                        db.add(
                            Room(
                                hostel_name=hostel_name,
                                floor=floor,
                                room_number=room_number,
                            )
                        )


        db.commit()

    yield

# =========================================================
# 7. CREATE APPLICATION
# =========================================================

app = FastAPI(
    title="quickCLKT Room Booking",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# =========================================================
# 8. AUTHENTICATION ENDPOINTS
# =========================================================

@app.post("/auth/register", status_code=201)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    student = Student(
        roll_number=data.roll_number,
        full_name=data.full_name,
        email=str(data.email).lower(),
        password_hash=hash_password(data.password),
        academic_year=data.academic_year,
        course=data.course,
        mobile_number=data.mobile_number,
        hostel_name=data.hostel_name,
        is_verified=False,
    )

    db.add(student)

    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This roll number or email may already be registered.",
        )

    return {
        "message": "Account created. Student verification is pending.",
        "student": student_response(student),
    }


@app.post("/auth/login")
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    student = db.scalar(
        select(Student).where(
            Student.roll_number == data.roll_number
        )
    )

    # Self-heal demo accounts if the deployment did not seed them at startup.
    # This fallback applies only to the two explicitly public demo accounts.
    if data.roll_number in {"DEMO001", "DEMO002"} and (
        student is None
        or not verify_password(data.password, student.password_hash)
    ):
        seed_demo_students(db)
        student = db.scalar(
            select(Student).where(
                Student.roll_number == data.roll_number
            )
        )

    if student is None or not verify_password(
        data.password, student.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid roll number or password.",
        )

    set_session_cookie(response, student.id)

    return {
        "message": "Login successful.",
        "student": student_response(student),
    }


@app.get("/auth/me")
def get_me(
    student: Student = Depends(get_current_student),
):
    return {"student": student_response(student)}


@app.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return {"message": "Logged out successfully."}


# =========================================================
# 9. ROOMMATE INVITATION ENDPOINTS
# =========================================================

@app.post("/roommates/invite", status_code=201)
def invite_roommate(
    data: RoommateInviteRequest,
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    target = db.scalar(
        select(Student).where(
            Student.roll_number == data.roll_number
        )
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="No student was found with that roll number.",
        )

    if target.id == current.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot invite yourself.",
        )

    if find_student_group(db, current.id):
        raise HTTPException(
            status_code=409,
            detail="You already belong to a roommate group.",
        )

    if find_student_group(db, target.id):
        raise HTTPException(
            status_code=409,
            detail="This student already belongs to a roommate group.",
        )

    existing = db.scalar(
        select(RoommateInvitation).where(
            RoommateInvitation.status == "pending",
            or_(
                (
                    (RoommateInvitation.inviter_id == current.id)
                    & (RoommateInvitation.invitee_id == target.id)
                ),
                (
                    (RoommateInvitation.inviter_id == target.id)
                    & (RoommateInvitation.invitee_id == current.id)
                ),
            ),
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending invitation already exists between these students.",
        )

    invitation = RoommateInvitation(
        inviter_id=current.id,
        invitee_id=target.id,
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return {
        "message": "Roommate invitation sent.",
        "invitation_id": invitation.id,
    }


@app.get("/roommates")
def roommate_status(
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    group = find_student_group(db, current.id)
    group_data = None

    if group:
        partner_id = (
            group.member2_id
            if group.member1_id == current.id
            else group.member1_id
        )
        partner = db.get(Student, partner_id)

        if partner:
            group_data = {
                "group_id": group.group_id,
                "partner": student_summary(partner),
                "created_at": group.created_at.isoformat(),
            }

    incoming_records = db.scalars(
        select(RoommateInvitation).where(
            RoommateInvitation.invitee_id == current.id,
            RoommateInvitation.status == "pending",
        ).order_by(RoommateInvitation.created_at.desc())
    ).all()

    outgoing_records = db.scalars(
        select(RoommateInvitation).where(
            RoommateInvitation.inviter_id == current.id,
            RoommateInvitation.status == "pending",
        ).order_by(RoommateInvitation.created_at.desc())
    ).all()

    incoming = []
    for item in incoming_records:
        sender = db.get(Student, item.inviter_id)
        if sender:
            incoming.append({
                "id": item.id,
                "student": student_summary(sender),
            })

    outgoing = []
    for item in outgoing_records:
        recipient = db.get(Student, item.invitee_id)
        if recipient:
            outgoing.append({
                "id": item.id,
                "student": student_summary(recipient),
            })

    return {
        "group": group_data,
        "incoming": incoming,
        "outgoing": outgoing,
    }


@app.post("/roommates/invitations/{invitation_id}/respond")
def respond_to_invitation(
    invitation_id: str,
    data: InvitationResponse,
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    invitation = db.get(RoommateInvitation, invitation_id)

    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if invitation.invitee_id != current.id:
        raise HTTPException(
            status_code=403,
            detail="Only the invited student can respond.",
        )

    if invitation.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="This invitation has already been answered.",
        )

    if not data.accept:
        invitation.status = "rejected"
        invitation.responded_at = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Invitation rejected."}

    # Lock both student records before checking group membership.
    member_ids = sorted([invitation.inviter_id, invitation.invitee_id])

    db.scalars(
        select(Student)
        .where(Student.id.in_(member_ids))
        .order_by(Student.id)
        .with_for_update()
    ).all()

    db.refresh(invitation)

    if invitation.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="This invitation has already been answered.",
        )

    if (
        find_student_group(db, invitation.inviter_id)
        or find_student_group(db, invitation.invitee_id)
    ):
        raise HTTPException(
            status_code=409,
            detail="One of these students already belongs to a group.",
        )

    group = RoommateGroup(
        group_id=generate_group_id(db),
        member1_id=invitation.inviter_id,
        member2_id=invitation.invitee_id,
    )

    invitation.status = "accepted"
    invitation.responded_at = datetime.now(timezone.utc)
    db.add(group)

    try:
        db.commit()
        db.refresh(group)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create the group. Refresh and try again.",
        )

    return {
        "message": "Invitation accepted. Your group has been created.",
        "group_id": group.group_id,
    }


# =========================================================
# 10. ROOM VALIDATION AND BOOKING ENDPOINTS
# =========================================================

@app.post("/rooms/validate-group")
def validate_roommate_pair(
    data: PairCodeRequest,
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    group, hostel, member1, member2 = get_validated_roommate_group(
        db, data.pair_code, current
    )

    booking = db.scalar(
        select(RoomBooking).where(
            RoomBooking.group_pk == group.id
        )
    )

    return {
        "valid": True,
        "pair_code": group.group_id,
        "hostel": hostel,
        "members": [
            student_summary(member1),
            student_summary(member2),
        ],
        "already_booked": booking is not None,
    }


@app.get("/rooms/floors")
def get_floor_rooms(
    pair_code: str,
    floor: int = Query(ge=1, le=14),
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    group, hostel, _, _ = get_validated_roommate_group(
        db, pair_code, current
    )

    existing_booking = db.scalar(
        select(RoomBooking).where(
            RoomBooking.group_pk == group.id
        )
    )

    rooms = db.execute(
        select(Room, RoomBooking)
        .outerjoin(RoomBooking, RoomBooking.room_id == Room.id)
        .where(
            Room.hostel_name == hostel,
            Room.floor == floor,
        )
        .order_by(Room.room_number)
    ).all()

    booked_room = None

    if existing_booking:
        room = db.get(Room, existing_booking.room_id)
        if room:
            booked_room = {
                "floor": room.floor,
                "room_number": room.room_number,
            }

    return {
        "hostel": hostel,
        "floor": floor,
        "group_id": group.group_id,
        "already_booked": existing_booking is not None,
        "booked_room": booked_room,
        "rooms": [
            {
                "room_number": room.room_number,
                "room_label": f"{floor}{room.room_number:02d}",
                "occupied": booking is not None,
            }
            for room, booking in rooms
        ],
    }


@app.post("/rooms/book", status_code=201)
def book_room(
    data: RoomBookingRequest,
    db: Session = Depends(get_db),
    current: Student = Depends(get_current_student),
):
    group, hostel, _, _ = get_validated_roommate_group(
        db, data.pair_code, current
    )

    existing_booking = db.scalar(
        select(RoomBooking).where(
            RoomBooking.group_pk == group.id
        )
    )

    if existing_booking:
        raise HTTPException(
            status_code=409,
            detail="Your group has already booked a room.",
        )

    room = db.scalar(
        select(Room).where(
            Room.hostel_name == hostel,
            Room.floor == data.floor,
            Room.room_number == data.room_number,
        )
    )

    if room is None:
        raise HTTPException(status_code=404, detail="Room not found.")

    booking = RoomBooking(
        room_id=room.id,
        group_pk=group.id,
    )
    db.add(booking)

    try:
        db.commit()
        db.refresh(booking)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "This room or group has already been booked. "
                "Refresh the floor plan and try again."
            ),
        )

    return {
        "message": "Room booked successfully.",
        "group_id": group.group_id,
        "hostel": hostel,
        "floor": room.floor,
        "room_number": room.room_number,
        "room_label": f"{room.floor}{room.room_number:02d}",
    }


# =========================================================
# 11. HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {"status": "ok"}
