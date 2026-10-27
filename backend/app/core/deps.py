"""Authentication and project-membership dependencies."""
from uuid import UUID
from fastapi import Depends,HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.security import decode_access_token
from app.modules.users.models import User
from app.modules.projects.models import Project,ProjectMember
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login/oauth")
async def get_current_user(token:str=Depends(oauth2),db:AsyncSession=Depends(get_db))->User:
 try: uid=UUID(decode_access_token(token))
 except Exception as exc: raise HTTPException(401,"Invalid or expired access token",headers={"WWW-Authenticate":"Bearer"}) from exc
 user=await db.get(User,uid)
 if user is None: raise HTTPException(401,"User no longer exists")
 return user
async def get_project_for_member(project_id:UUID,user:User,db:AsyncSession)->Project:
 result=await db.execute(select(Project).join(ProjectMember).where(Project.id==project_id,ProjectMember.user_id==user.id))
 project=result.scalar_one_or_none()
 if project is None: raise HTTPException(404,"Project not found")
 return project
async def require_owner(project_id:UUID,user:User,db:AsyncSession)->Project:
 project=await get_project_for_member(project_id,user,db)
 membership=(await db.execute(select(ProjectMember).where(ProjectMember.project_id==project_id,ProjectMember.user_id==user.id))).scalar_one_or_none()
 if membership is None or membership.role!="OWNER":
  raise HTTPException(403,"Only project owners can perform this action.")
 return project

async def require_editor(project_id:UUID,user:User,db:AsyncSession)->Project:
 project=await get_project_for_member(project_id,user,db)
 membership=(await db.execute(select(ProjectMember).where(ProjectMember.project_id==project_id,ProjectMember.user_id==user.id))).scalar_one_or_none()
 if membership is None or membership.role not in ("OWNER", "EDITOR"):
  raise HTTPException(403,"Viewers have read-only access to this workspace.")
 return project
