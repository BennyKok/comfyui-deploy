# Reference from https://github.com/ty0x2333/ComfyUI-Dev-Utils/blob/main/nodes/execution_time.py

import server
import torch
import time
import execution
from tabulate import tabulate
from model_management import get_torch_device
import psutil


from logging import basicConfig, getLogger

logger = getLogger("comfy-deploy")
basicConfig(level="INFO")  # You can adjust the logging level as needed

prompt_server = server.PromptServer.instance

NODE_EXECUTION_TIMES = {}  # New dictionary to store node execution times

def get_peak_memory():
    device = get_torch_device()
    if device.type == 'cuda':
        return torch.cuda.max_memory_allocated(device)
    elif device.type == 'mps':
        # Return system memory usage for MPS devices
        return psutil.Process().memory_info().rss
    return 0


def reset_peak_memory_record():
    device = get_torch_device()
    if device.type == 'cuda':
        torch.cuda.reset_max_memory_allocated(device)
    # MPS doesn't need reset as we're not tracking its memory


def handle_execute(class_type, last_node_id, prompt_id, server, unique_id):
    if not CURRENT_START_EXECUTION_DATA:
        return
    start_time = CURRENT_START_EXECUTION_DATA["nodes_start_perf_time"].get(unique_id)
    start_vram = CURRENT_START_EXECUTION_DATA["nodes_start_vram"].get(unique_id)
    if start_time:
        end_time = time.perf_counter()
        execution_time = end_time - start_time

        end_vram = get_peak_memory()
        vram_used = end_vram - start_vram
        # print(f"end_vram - start_vram: {end_vram} - {start_vram} = {vram_used}")
        NODE_EXECUTION_TIMES[unique_id] = {
            "time": execution_time,
            "class_type": class_type,
            "vram_used": vram_used
        }
        # print(f"#{unique_id} [{class_type}]: {execution_time:.2f}s - vram {vram_used}b")


try:
    origin_execute = execution.execute

    def swizzle_execute(
        server,
        dynprompt,
        caches,
        current_item,
        extra_data,
        executed,
        prompt_id,
        execution_list,
        pending_subgraph_results,
    ):
        unique_id = current_item
        class_type = dynprompt.get_node(unique_id)["class_type"]
        last_node_id = server.last_node_id
        result = origin_execute(
            server,
            dynprompt,
            caches,
            current_item,
            extra_data,
            executed,
            prompt_id,
            execution_list,
            pending_subgraph_results,
        )
        handle_execute(class_type, last_node_id, prompt_id, server, unique_id)
        return result

    execution.execute = swizzle_execute
except Exception as e:
    pass

CURRENT_START_EXECUTION_DATA = None
origin_func = server.PromptServer.send_sync

def format_table(headers, data):
    # Calculate column widths
    widths = [len(h) for h in headers]
    for row in data:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))
    
    # Create separator line
    separator = '+' + '+'.join('-' * (w + 2) for w in widths) + '+'
    
    # Format header
    result = [separator]
    header_row = '|' + '|'.join(f' {h:<{w}} ' for w, h in zip(widths, headers)) + '|'
    result.append(header_row)
    result.append(separator)
    
    # Format data rows
    for row in data:
        data_row = '|' + '|'.join(f' {str(cell):<{w}} ' for w, cell in zip(widths, row)) + '|'
        result.append(data_row)
    
    result.append(separator)
    return '\n'.join(result)


def swizzle_send_sync(self, event, data, sid=None):
    # print(f"swizzle_send_sync, event: {event}, data: {data}")
    global CURRENT_START_EXECUTION_DATA
    if event == "execution_start":
        global NODE_EXECUTION_TIMES
        NODE_EXECUTION_TIMES = {}  # Reset execution times at start
        CURRENT_START_EXECUTION_DATA = dict(
            start_perf_time=time.perf_counter(),
            nodes_start_perf_time={},
            nodes_start_vram={},
        )

    origin_func(self, event=event, data=data, sid=sid)

    if event == "executing" and data and CURRENT_START_EXECUTION_DATA:
        if data.get("node") is None:
            start_perf_time = CURRENT_START_EXECUTION_DATA.get("start_perf_time")
            new_data = data.copy()
            if start_perf_time is not None:
                execution_time = time.perf_counter() - start_perf_time
                new_data["execution_time"] = int(execution_time * 1000)
                
            # Replace the print statements with tabulate
            headers = ["Node ID", "Type", "Time (s)", "VRAM (GB)"]
            table_data = []
            for node_id, node_data in NODE_EXECUTION_TIMES.items():
                vram_gb = node_data['vram_used'] / (1024**3)  # Convert bytes to GB
                table_data.append([
                    f"#{node_id}",
                    node_data['class_type'],
                    f"{node_data['time']:.2f}",
                    f"{vram_gb:.2f}"
                ])
            
            # Add total execution time as the last row
            table_data.append([
                "TOTAL",
                "-",
                f"{execution_time:.2f}",
                "-"
            ])
            
            # print("\n=== Node Execution Times ===")
            logger.info("Printing Node Execution Times")
            logger.info(format_table(headers, table_data))
            # print("========================\n")
                
            
        else:
            node_id = data.get("node")
            CURRENT_START_EXECUTION_DATA["nodes_start_perf_time"][node_id] = (
                time.perf_counter()
            )
            reset_peak_memory_record()
            CURRENT_START_EXECUTION_DATA["nodes_start_vram"][node_id] = (
                get_peak_memory()
            )


server.PromptServer.send_sync = swizzle_send_sync
