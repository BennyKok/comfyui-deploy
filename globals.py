import struct
from enum import Enum
import aiohttp
from typing import List, Union, Any, Optional
from PIL import Image, ImageOps
from io import BytesIO
from pydantic import BaseModel as PydanticBaseModel


class BaseModel(PydanticBaseModel):
    class Config:
        arbitrary_types_allowed = True


class Status(Enum):
    NOT_STARTED = "not-started"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    UPLOADING = "uploading"
    CANCELLED = "cancelled"


class StreamingPrompt(BaseModel):
    workflow_api: Any
    auth_token: str
    inputs: dict[str, Union[str, bytes, Image.Image]]
    running_prompt_ids: set[str] = set()
    status_endpoint: Optional[str]
    file_upload_endpoint: Optional[str]
    workflow: Any
    gpu_event_id: Optional[str] = None


class SimplePrompt(BaseModel):
    status_endpoint: Optional[str]
    file_upload_endpoint: Optional[str]

    token: Optional[str]

    workflow_api: dict
    status: Status = Status.NOT_STARTED
    progress: set = set()
    last_updated_node: Optional[str] = None
    uploading_nodes: set = set()
    done: bool = False
    is_realtime: bool = False
    start_time: Optional[float] = None
    gpu_event_id: Optional[str] = None


sockets = dict()
prompt_metadata: dict[str, SimplePrompt] = {}
streaming_prompt_metadata: dict[str, StreamingPrompt] = {}


class BinaryEventTypes:
    PREVIEW_IMAGE = 1
    UNENCODED_PREVIEW_IMAGE = 2


max_output_id_length = 24


async def send_image(image_data, sid=None, output_id: str = None):
    max_length = max_output_id_length
    output_id = output_id[:max_length]
    padded_output_id = output_id.ljust(max_length, "\x00")
    encoded_output_id = padded_output_id.encode("ascii", "replace")

    image_type = image_data[0]
    image = image_data[1]
    max_size = image_data[2]
    quality = image_data[3]
    if max_size is not None:
        if hasattr(Image, "Resampling"):
            resampling = Image.Resampling.BILINEAR
        else:
            resampling = Image.ANTIALIAS

        image = ImageOps.contain(image, (max_size, max_size), resampling)
    type_num = 1
    if image_type == "JPEG":
        type_num = 1
    elif image_type == "PNG":
        type_num = 2
    elif image_type == "WEBP":
        type_num = 3

    bytesIO = BytesIO()
    header = struct.pack(">I", type_num)
    # 4 bytes for the type
    bytesIO.write(header)
    # 10 bytes for the output_id
    position_before = bytesIO.tell()
    bytesIO.write(encoded_output_id)
    position_after = bytesIO.tell()
    bytes_written = position_after - position_before
    print(f"Bytes written: {bytes_written}")

    image.save(bytesIO, format=image_type, quality=quality, compress_level=1)
    preview_bytes = bytesIO.getvalue()
    await send_bytes(BinaryEventTypes.PREVIEW_IMAGE, preview_bytes, sid=sid)


async def send_socket_catch_exception(function, message):
    try:
        await function(message)
    except (
        aiohttp.ClientError,
        aiohttp.ClientPayloadError,
        ConnectionResetError,
    ) as err:
        print("send error:", err)


def encode_bytes(event, data):
    if not isinstance(event, int):
        raise RuntimeError(f"Binary event types must be integers, got {event}")

    packed = struct.pack(">I", event)
    message = bytearray(packed)
    message.extend(data)
    return message


async def send_bytes(event, data, sid=None):
    message = encode_bytes(event, data)

    print("sending image to ", event, sid)

    if sid is None:
        _sockets = list(sockets.values())
        for ws in _sockets:
            await send_socket_catch_exception(ws.send_bytes, message)
    elif sid in sockets:
        await send_socket_catch_exception(sockets[sid].send_bytes, message)
