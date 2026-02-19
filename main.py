import json
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse

app = FastAPI(title="ClaudePad")

# Paths
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
DATA_DIR = BASE_DIR / "data"

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def read_json_file(file_path: Path):
    """Read JSON file safely."""
    if not file_path.exists():
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_file(file_path: Path, data):
    """Write JSON file safely."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.get("/")
async def index(request: Request):
    """Redirect to current project or show project selector."""
    projects_data = read_json_file(DATA_DIR / "projects.json")
    project = None
    tasks = []

    if projects_data and projects_data.get("current_project"):
        project = projects_data["current_project"]
        tasks_data = read_json_file(DATA_DIR / "projects" / project / "tasks.json")
        if tasks_data:
            tasks = tasks_data.get("tasks", [])

    return templates.TemplateResponse("index.html", {
        "request": request,
        "project": project,
        "tasks": tasks
    })


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# ============ API Routes ============

@app.get("/api/projects")
async def get_projects():
    """Get all projects."""
    projects_data = read_json_file(DATA_DIR / "projects.json")
    if not projects_data:
        return {"projects": [], "current_project": None}
    return projects_data


@app.post("/api/projects")
async def create_project(request: Request):
    """Create a new project."""
    data = await request.json()
    name = data.get("name")
    path = data.get("path", "")

    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")

    projects_data = read_json_file(DATA_DIR / "projects.json") or {"projects": [], "current_project": None}

    # Check if project already exists
    if any(p["name"] == name for p in projects_data.get("projects", [])):
        raise HTTPException(status_code=400, detail="Project already exists")

    from datetime import datetime
    projects_data["projects"].append({
        "name": name,
        "path": path,
        "created_at": datetime.now().isoformat()
    })

    # Set as current if first project
    if len(projects_data["projects"]) == 1:
        projects_data["current_project"] = name

    write_json_file(DATA_DIR / "projects.json", projects_data)

    # Create tasks.json for the new project
    tasks_dir = DATA_DIR / "projects" / name
    tasks_dir.mkdir(parents=True, exist_ok=True)
    write_json_file(tasks_dir / "tasks.json", {"tasks": []})

    return {"name": name, "path": path}


@app.put("/api/projects/{name}/switch")
async def switch_project(name: str):
    """Switch to a different project."""
    projects_data = read_json_file(DATA_DIR / "projects.json")
    if not projects_data:
        raise HTTPException(status_code=404, detail="No projects found")

    if not any(p["name"] == name for p in projects_data.get("projects", [])):
        raise HTTPException(status_code=404, detail="Project not found")

    projects_data["current_project"] = name
    write_json_file(DATA_DIR / "projects.json", projects_data)

    return {"current_project": name}


@app.get("/api/{project}/tasks")
async def get_tasks(project: str):
    """Get all tasks for a project."""
    tasks_data = read_json_file(DATA_DIR / "projects" / project / "tasks.json")
    if not tasks_data:
        return []
    return tasks_data.get("tasks", [])


@app.post("/api/{project}/tasks")
async def create_task(project: str, request: Request):
    """Create a new task."""
    data = await request.json()

    tasks_file = DATA_DIR / "projects" / project / "tasks.json"
    tasks_data = read_json_file(tasks_file) or {"tasks": []}

    from datetime import datetime
    today = datetime.now().strftime("%Y%m%d")

    # Generate task ID
    existing_ids = [t["id"] for t in tasks_data["tasks"] if t["id"].startswith(today)]
    next_num = len(existing_ids) + 1
    task_id = f"{today}-{next_num:03d}"

    task = {
        "id": task_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "status": "pending",
        "is_plan": data.get("is_plan", False),
        "prompt": data.get("prompt", ""),
        "attachments": [],
        "git_branch": None,
        "git_commits": [],
        "git_parent_commit": None,
        "output_file": None,
        "deleted": False,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    tasks_data["tasks"].append(task)
    write_json_file(tasks_file, tasks_data)

    return task


@app.put("/api/{project}/tasks/{task_id}")
async def update_task(project: str, task_id: str, request: Request):
    """Update a task."""
    data = await request.json()

    tasks_file = DATA_DIR / "projects" / project / "tasks.json"
    tasks_data = read_json_file(tasks_file)

    if not tasks_data:
        raise HTTPException(status_code=404, detail="Tasks file not found")

    for task in tasks_data["tasks"]:
        if task["id"] == task_id:
            from datetime import datetime
            task.update(data)
            task["updated_at"] = datetime.now().isoformat()
            write_json_file(tasks_file, tasks_data)
            return task

    raise HTTPException(status_code=404, detail="Task not found")


@app.post("/api/{project}/tasks/{task_id}/status")
async def update_task_status(project: str, task_id: str, request: Request):
    """Update task status."""
    data = await request.json()
    new_status = data.get("status")

    valid_statuses = ["pending", "developing", "review", "completed", "failed", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")

    return await update_task(project, task_id, {"status": new_status})


def run_server():
    """Entry point for uv run claudpad."""
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    run_server()
