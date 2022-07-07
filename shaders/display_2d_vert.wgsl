// Vertex shader
struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragPosition: vec4<f32>,
};
struct Uniforms {
    view_box : vec4<f32>,
    width : u32,
    height : u32,
};

@group(0) @binding(2) var<uniform> uniforms : Uniforms;

@vertex
fn main(@location(0) position : vec4<f32>)
     -> VertexOutput {
    // position is (-1, 1)
    var outPos : vec2<f32> = vec2<f32>(
      (0.5 * position.x + 0.5) * (uniforms.view_box.z - uniforms.view_box.x) + uniforms.view_box.x, 
      (0.5 * position.y + 0.5) * (uniforms.view_box.w - uniforms.view_box.y) + uniforms.view_box.y
    );
    var output : VertexOutput;
    output.Position = position;
    output.fragPosition = vec4<f32>(outPos.x, outPos.y, 0.0, 1.0);
    return output;
}


