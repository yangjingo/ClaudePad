import pytest
import asyncio
from terminal_process import TerminalProcess

@pytest.mark.asyncio
async def test_terminal_process_starts():
    """Test that terminal process can start a shell."""
    process = TerminalProcess()
    await process.start()
    assert process.is_running() == True
    await process.stop()

@pytest.mark.asyncio
async def test_terminal_process_write_read():
    """Test writing to and reading from terminal."""
    process = TerminalProcess()
    await process.start()

    # Write a command
    await process.write("echo 'hello'\n")

    # Wait and read output
    await asyncio.sleep(0.5)
    output = await process.read()
    assert "hello" in output.lower()

    await process.stop()

@pytest.mark.asyncio
async def test_terminal_process_resize():
    """Test resizing terminal."""
    process = TerminalProcess()
    await process.start()

    await process.resize(24, 80)
    assert process.rows == 24
    assert process.cols == 80

    await process.stop()
