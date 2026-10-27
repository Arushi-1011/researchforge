"""Password hashing and signed access tokens."""
import hashlib
import secrets
from datetime import datetime,timedelta,timezone
import jwt
from pwdlib import PasswordHash
from app.core.config import settings
_hash=PasswordHash.recommended()
def hash_password(password:str)->str: return _hash.hash(password)
def verify_password(password:str,encoded:str)->bool: return _hash.verify(password,encoded)
def create_access_token(user_id:str)->str:
 now=datetime.now(timezone.utc)
 return jwt.encode({"sub":user_id,"iat":now,"exp":now+timedelta(minutes=settings.access_token_minutes)},settings.jwt_secret,algorithm="HS256")
def decode_access_token(token:str)->str: return str(jwt.decode(token,settings.jwt_secret,algorithms=["HS256"])["sub"])
def hash_token(raw:str)->str: return hashlib.sha256(raw.encode()).hexdigest()
def create_refresh_token(user_id:str,refresh_token_days:int=30)->tuple[str,str,datetime]:
 raw=secrets.token_urlsafe(32)
 hashed=hash_token(raw)
 expiry=datetime.now(timezone.utc)+timedelta(days=refresh_token_days)
 return raw,hashed,expiry
