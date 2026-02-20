import json
import asyncio
import uuid
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
from fastapi import WebSocket
from fastapi.responses import HTMLResponse
import fcntl
import struct
import pty
import select
import os
from typing import Dict

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


# Terminal history
TERMINAL_HISTORY_FILE = DATA_DIR / "terminal_history.json"


def get_terminal_history():
    """Get terminal command history."""
    history = read_json_file(TERMINAL_HISTORY_FILE)
    if not history:
        return {"commands": [], "last_updated": None}
    return history


def add_to_terminal_history(command: str):
    """Add command to history (deduplicated)."""
    history = get_terminal_history()
    commands = history["commands"]

    # Remove duplicate if exists
    if command in commands:
        commands.remove(command)

    # Add to front
    commands.insert(0, command)

    # Keep only last 1000 commands
    commands = commands[:1000]

    from datetime import datetime
    write_json_file(TERMINAL_HISTORY_FILE, {
        "commands": commands,
        "last_updated": datetime.now().isoformat()
    })


# Terminal session management
terminal_sessions: Dict[str, dict] = {}


class TerminalSession:
    """Manages a terminal session with PTY."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.master_fd = None
        self.pid = None
        self.rows = 24
        self.cols = 80
        self.shell = "/bin/bash"

    def start(self):
        """Start the pseudo-terminal."""
        # Validate shell exists and is executable before forking
        if not os.path.exists(self.shell):
            raise FileNotFoundError(f"Shell not found: {self.shell}")
        if not os.access(self.shell, os.X_OK):
            raise PermissionError(f"Shell is not executable: {self.shell}")

        # Use try-finally to ensure slave_fd is always closed
        slave_fd = None
        try:
            self.master_fd, slave_fd = pty.openpty()
            self.pid = os.fork()

            if self.pid == 0:  # Child
                os.setsid()
                os.dup2(slave_fd, 0)
                os.dup2(slave_fd, 1)
                os.dup2(slave_fd, 2)
                os.close(slave_fd)
                os.close(self.master_fd)

                env = os.environ.copy()
                env["TERM"] = "xterm-256color"
                os.execvp(self.shell, [self.shell])
            else:  # Parent
                os.close(slave_fd)
        finally:
            # Ensure slave_fd is closed even if fork fails
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass

    def write(self, data: str):
        """Write to terminal."""
        if self.master_fd:
            os.write(self.master_fd, data.encode())

    def resize(self, rows: int, cols: int):
        """Resize terminal."""
        if self.master_fd:
            fcntl.ioctl(
                self.master_fd,
                pty.TIOCSWINSZ,
                struct.pack("HHHH", rows, cols, 0, 0)
            )
            self.rows = rows
            self.cols = cols

    def read(self) -> str:
        """Read from terminal (non-blocking)."""
        if not self.master_fd:
            return ""

        try:
            r, _, _ = select.select([self.master_fd], [], [], 0)
            if r:
                return os.read(self.master_fd, 4096).decode('utf-8', errors='ignore')
        except OSError:
            pass
        return ""

    def is_running(self) -> bool:
        """Check if process is running."""
        if self.pid is None:
            return False
        try:
            os.kill(self.pid, 0)
            return True
        except OSError:
            return False

    def stop(self):
        """Stop the terminal."""
        if self.pid:
            try:
                os.kill(self.pid, 9)  # SIGKILL
                # Reap zombie process to prevent resource leak
                try:
                    os.waitpid(self.pid, 0)
                except ChildProcessError:
                    pass  # Child already reaped
            except OSError:
                pass

        # Use try/finally to ensure master_fd = None always executes
        if self.master_fd:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            finally:
                self.master_fd = None


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


@app.get("/terminal")
async def terminal_page(request: Request):
    """Terminal page."""
    return templates.TemplateResponse("terminal.html", {"request": request})


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


@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    """WebSocket endpoint for terminal I/O."""
    await websocket.accept()

    session_id = str(uuid.uuid4())
    session = TerminalSession(session_id)
    session.start()
    terminal_sessions[session_id] = session

    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "status",
            "state": "connected",
            "session_id": session_id
        })

        # Main terminal loop
        while True:
            # Check for incoming messages from client
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.05
                )
                data = json.loads(message)

                if data["type"] == "input":
                    session.write(data["data"])
                elif data["type"] == "resize":
                    session.resize(data["rows"], data["cols"])

            except asyncio.TimeoutError:
                pass  # No message from client, check for terminal output

            # Read and send terminal output
            output = session.read()
            if output:
                await websocket.send_json({
                    "type": "output",
                    "data": output
                })

            # Check if process is still running
            if not session.is_running():
                await websocket.send_json({
                    "type": "status",
                    "state": "disconnected"
                })
                break

            await asyncio.sleep(0.01)

    except Exception as e:
        print(f"Terminal error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass  # WebSocket already closed
    finally:
        session.stop()
        if session_id in terminal_sessions:
            del terminal_sessions[session_id]


@app.get("/api/terminal/history")
async def get_history():
    """Get command history."""
    history = get_terminal_history()
    return history


@app.post("/api/terminal/history")
async def add_history(request: Request):
    """Add command to history."""
    data = await request.json()
    command = data.get("command", "").strip()
    if command:
        add_to_terminal_history(command)
    return {"status": "ok"}


if __name__ == "__main__":
    run_server()
