"""Validated account request contracts."""
from pydantic import BaseModel,EmailStr,Field
class RegisterIn(BaseModel): email:EmailStr;password:str=Field(min_length=8);display_name:str=Field(min_length=1,max_length=120)
class LoginIn(BaseModel): email:EmailStr;password:str
