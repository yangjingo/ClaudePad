import asyncio
import pty
import os
import select
import subprocess
from typing import Optional, Callable
import fcntl
import struct


class TerminalProcess:
    """Manages a pseudo-terminal process for the web terminal."""

    def __init__(self, shell: str = "/bin/bash"):
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self.shell = shell
        self.rows = 24
        self.cols = 80
        self._read_task: Optional[asyncio.Task] = None
        self._output_callback: Optional[Callable] = None

    async def start(self, output_callback: Optional[Callable] = None):
        """Start the pseudo-terminal with the shell."""
        self._output_callback = output_callback

        # Create pseudo-terminal
        self.master_fd, slave_fd = pty.openpty()

        # Start the shell in the pseudo-terminal
        self.pid = os.fork()
        if self.pid == 0:  # Child process
            os.setsid()
            os.dup2(slave_fd, 0)  # stdin
            os.dup2(slave_fd, 1)  # stdout
            os.dup2(slave_fd, 2)  # stderr
            os.close(slave_fd)
            os.close(self.master_fd)

            # Start shell with Claude Code available
            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            os.execvp(self.shell, [self.shell])
        else:  # Parent process
            os.close(slave_fd)
            # Start reading output
            self._read_task = asyncio.create_task(self._read_output())

    async def _read_output(self):
        """Continuously read output from the pseudo-terminal."""
        loop = asyncio.get_event_loop()
        while self.is_running():
            try:
                # Wait for data to be available
                r, _, _ = await loop.run_in_executor(
                    None, select.select, [self.master_fd], [], [], 0.1
                )
                if r:
                    data = await loop.run_in_executor(
                        None, os.read, self.master_fd, 4096
                    )
                    if data and self._output_callback:
                        self._output_callback(data.decode('utf-8', errors='ignore'))
            except (OSError, ValueError):
                break

    async def write(self, data: str):
        """Write data to the terminal."""
        if self.master_fd is not None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, os.write, self.master_fd, data.encode('utf-8')
            )

    async def read(self) -> str:
        """Read available data from terminal (non-blocking)."""
        if self.master_fd is None:
            return ""

        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None, os.read, self.master_fd, 4096
            )
            return data.decode('utf-8', errors='ignore') if data else ""
        except BlockingIOError:
            return ""

    async def resize(self, rows: int, cols: int):
        """Resize the terminal."""
        self.rows = rows
        self.cols = cols
        if self.master_fd is not None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                fcntl.ioctl,
                self.master_fd,
                pty.TIOCSWINSZ,
                struct.pack("HHHH", rows, cols, 0, 0)
            )

    def is_running(self) -> bool:
        """Check if the process is still running."""
        if self.pid is None:
            return False
        try:
            os.kill(self.pid, 0)
            return True
        except OSError:
            return False

    async def stop(self):
        """Stop the terminal process."""
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        if self.pid:
            try:
                os.kill(self.pid, 9)  # SIGKILL
            except OSError:
                pass

        if self.master_fd is not None:
            os.close(self.master_fd)
            self.master_fd = None
