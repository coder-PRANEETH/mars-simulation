"""Read regular samples from a remote, uncompressed one-row-strip GeoTIFF."""
import concurrent.futures
import http.client
import struct
import threading
import time
from urllib.parse import urlsplit

import numpy as np


def samples(url, rows, columns):
    address = urlsplit(url)
    connections = threading.local()

    def read(offset, count):
        for attempt in range(4):
            try:
                if not hasattr(connections, "http"):
                    connections.http = http.client.HTTPSConnection(address.netloc, timeout=25)
                end = offset + count - 1
                connections.http.request("GET", address.path, headers={"Range": f"bytes={offset}-{end}"})
                response = connections.http.getresponse()
                if response.status != 206 or not response.getheader("Content-Range", "").startswith(f"bytes {offset}-{end}/"):
                    raise OSError(f"Unexpected range response {response.status}: {response.getheader('Content-Range')}")
                data = response.read()
                if len(data) != count:
                    raise OSError(f"Received {len(data)} of {count} bytes")
                return data
            except (OSError, http.client.HTTPException):
                connections.http.close()
                del connections.http
                if attempt == 3:
                    raise
                time.sleep(0.2 * (attempt + 1))

    header = read(0, 16)
    order = "<" if header[:2] == b"II" else ">"
    version = struct.unpack_from(order + "H", header, 2)[0]
    big = version == 43
    if version not in (42, 43):
        raise ValueError("Expected TIFF or BigTIFF")
    length_code, pointer_code, entry_code = ("Q", "Q", "HHQQ") if big else ("H", "I", "HHII")
    size_field, size_pointer, size_entry = (8, 8, 20) if big else (2, 4, 12)
    directory = struct.unpack_from(order + pointer_code, header, 8 if big else 4)[0]
    count = struct.unpack(order + length_code, read(directory, size_field))[0]
    table = read(directory + size_field, count * size_entry)
    tags = {}
    for i in range(count):
        start = i * size_entry
        tag, kind, length, pointer = struct.unpack_from(order + entry_code, table, start)
        types = {3: "u2", 4: "u4", 16: "u8"}
        if kind not in types:
            continue
        dtype = np.dtype(order + types[kind])
        size = length * dtype.itemsize
        if tag in {256, 257, 258, 259, 273, 277, 278, 339}:
            data = (table[start + size_entry - size_pointer:start + size_entry - size_pointer + size]
                    if size <= size_pointer else read(pointer, size))
            tags[tag] = np.frombuffer(data, dtype=dtype)
    if tags[259][0] != 1 or tags[278][0] != 1 or tags.get(277, [1])[0] != 1:
        raise ValueError("Expected single-band uncompressed TIFF with one row per strip")
    offsets = tags[273]
    width = tags[256][0]
    dtype = np.dtype(order + {1: "u", 2: "i", 3: "f"}[int(tags.get(339, [1])[0])] + str(int(tags[258][0]) // 8))
    if rows.min() < 0 or rows.max() >= len(offsets) or columns.min() < 0 or columns.max() >= width:
        raise ValueError("Sampling area is outside the source raster")

    first = int(columns.min())
    length = int(columns.max() - first + 1) * dtype.itemsize

    def row_values(row):
        offset = int(offsets[row]) + first * dtype.itemsize
        return np.frombuffer(read(offset, length), dtype=dtype)[columns - first]

    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        return np.stack(list(pool.map(row_values, rows)))
