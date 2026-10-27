"""Project CRUD and member management; project data is hidden from non-members."""
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy import select,func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user,get_project_for_member,require_owner
from app.modules.users.models import User
from app.modules.projects.models import Project,ProjectMember
from app.modules.users.models import User as Account
router=APIRouter(prefix="/projects",tags=["projects"])
class ProjectIn(BaseModel): name:str=Field(min_length=1,max_length=120);description:str=""
class MemberIn(BaseModel): email:str
@router.get("")
async def list_projects(db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 rows=(await db.execute(select(Project,func.count(ProjectMember.user_id).label("members")).join(ProjectMember).where(ProjectMember.user_id==user.id).group_by(Project.id))).all()
 return [{"id":str(p.id),"name":p.name,"description":p.description,"members":n,"created_at":p.created_at.isoformat()} for p,n in rows]
@router.post("",status_code=201)
async def create_project(data:ProjectIn,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 p=Project(name=data.name.strip(),description=data.description,created_by=user.id);db.add(p);await db.flush();db.add(ProjectMember(project_id=p.id,user_id=user.id,role="OWNER"));await db.commit()
 return {"id":str(p.id),"name":p.name,"description":p.description,"members":1}
@router.get("/{project_id}")
async def project_detail(project_id:UUID,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 p=await get_project_for_member(project_id,user,db);return {"id":str(p.id),"name":p.name,"description":p.description}
@router.patch("/{project_id}")
async def update_project(project_id:UUID,data:ProjectIn,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 p=await require_owner(project_id,user,db);p.name=data.name.strip();p.description=data.description;await db.commit();return {"id":str(p.id),"name":p.name,"description":p.description}
@router.delete("/{project_id}",status_code=204)
async def delete_project(project_id:UUID,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 p=await require_owner(project_id,user,db);await db.delete(p);await db.commit()
@router.get("/{project_id}/members")
async def members(project_id:UUID,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 await get_project_for_member(project_id,user,db)
 rows=(await db.execute(select(Account,ProjectMember.role).join(ProjectMember,ProjectMember.user_id==Account.id).where(ProjectMember.project_id==project_id))).all()
 return [{"id":str(m.id),"email":m.email,"display_name":m.display_name,"role":member_role} for m,member_role in rows]
@router.post("/{project_id}/members",status_code=201)
async def add_member(project_id:UUID,data:MemberIn,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 await get_project_for_member(project_id,user,db)
 target=(await db.execute(select(Account).where(Account.email==data.email.lower().strip()))).scalar_one_or_none()
 if target is None: raise HTTPException(404,"User must register before being invited")
 if await db.get(ProjectMember,(project_id,target.id)): raise HTTPException(409,"User is already a member")
 db.add(ProjectMember(project_id=project_id,user_id=target.id,role="EDITOR"));await db.commit();return {"id":str(target.id),"email":target.email,"display_name":target.display_name}
@router.delete("/{project_id}/members/{user_id}",status_code=204)
async def remove_member(project_id:UUID,user_id:UUID,db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
 await get_project_for_member(project_id,user,db)
 count=(await db.execute(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id==project_id))).scalar_one()
 membership=await db.get(ProjectMember,(project_id,user_id))
 if membership is None: raise HTTPException(404,"Member not found")
 if count<=1: raise HTTPException(409,"The last member cannot leave; delete the project instead")
 # Owners can remove editors/viewers; any member can remove themselves.
 caller_membership=await db.get(ProjectMember,(project_id,user.id))
 is_owner=caller_membership is not None and caller_membership.role=="OWNER"
 if user_id!=user.id and not is_owner: raise HTTPException(403,"Only project owners can remove other members")
 # Prevent removing the last owner
 if membership.role=="OWNER":
  owner_count=(await db.execute(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id==project_id,ProjectMember.role=="OWNER"))).scalar_one()
  if owner_count<=1: raise HTTPException(409,"Cannot remove the last owner; transfer ownership first")
 await db.delete(membership);await db.commit()
