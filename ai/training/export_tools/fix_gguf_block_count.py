"""
Rewrites the GGUF file, copying every metadata field and tensor unchanged,
except trimming qwen35.attention.recurrent_layers from 33 to 32 elements
(dropping the phantom MTP block-32 entry) to match the already-corrected
qwen35.block_count=32 (block 32 has zero tensors -- the merged model never
loaded the MTP head's weights in the first place).
"""
import sys
from gguf import GGUFReader, GGUFWriter, GGUFValueType, GGUFEndian

SRC = r"C:\Users\admin\Desktop\File All\Demo project\Project\EL\ai\training\output\qwen3.5-4b-project.gguf"
DST = r"C:\Users\admin\Desktop\File All\Demo project\Project\EL\ai\training\output\qwen3.5-4b-project.fixed.gguf"

SKIP_FIELDS = {"GGUF.version", "GGUF.tensor_count", "GGUF.kv_count", "general.architecture"}

reader = GGUFReader(SRC)

arch_field = reader.fields["general.architecture"]
arch = bytes(arch_field.parts[arch_field.data[0]]).decode("utf-8")
print(f"architecture: {arch}")

writer = GGUFWriter(DST, arch, endianess=GGUFEndian.LITTLE)


def scalar_value(vtype, part):
    if vtype == GGUFValueType.STRING:
        return bytes(part).decode("utf-8")
    if vtype == GGUFValueType.BOOL:
        return bool(part[0])
    return part[0].item()


n_fields = 0
for name, field in reader.fields.items():
    if name in SKIP_FIELDS:
        continue
    outer = field.types[0]
    if outer == GGUFValueType.ARRAY:
        elem_type = field.types[1]
        values = [scalar_value(elem_type, field.parts[i]) for i in field.data]
        if name == "qwen35.attention.recurrent_layers":
            assert len(values) == 33, f"expected 33 elements before trim, got {len(values)}"
            values = values[:32]
            print(f"trimmed {name}: 33 -> {len(values)} elements")
        writer.add_array(name, values)
    else:
        val = scalar_value(outer, field.parts[field.data[0]])
        writer.add_key_value(name, val, outer)
    n_fields += 1

print(f"copied {n_fields} metadata fields")

n_tensors = 0
for t in reader.tensors:
    # No raw_shape override: add_tensor() defaults to tensor.shape (= t.data.shape,
    # the byte-packed numpy shape for quantized types), which is exactly what
    # quant_shape_from_byte_shape() expects to convert back to the logical shape.
    # Passing t.shape (the GGUF-order logical shape) here was wrong -- it's a
    # different axis order and byte-vs-element-count, not interchangeable.
    writer.add_tensor(t.name, t.data, raw_dtype=t.tensor_type)
    n_tensors += 1
print(f"copied {n_tensors} tensors")

writer.write_header_to_file()
writer.write_kv_data_to_file()
writer.write_tensors_to_file(progress=True)
writer.close()
print(f"Wrote {DST}")
