// Vertex shader
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vray_dir: vec3<f32>,
  @location(1) @interpolate(flat) transformed_eye: vec3<f32>,
};
struct Uniforms {
  proj_view : mat4x4<f32>,
  eye_pos : vec4<f32>,
};
struct Image {
    view_box : vec4<f32>,
    width : u32,
    height : u32,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<uniform> image_size : Image;

@vertex
fn main(@location(0) position : vec3<f32>)
     -> VertexOutput {
    var output : VertexOutput;
    // var volume_translation : vec3<f32> = vec3<f32>(-0.5, -0.5, -0.5);
    // output.Position = uniforms.proj_view * vec4<f32>(position + volume_translation, 1.0);
    // output.transformed_eye = uniforms.eye_pos.xyz - volume_translation;
    // output.vray_dir = position - output.transformed_eye;
    // return output;
    var longest_axis : f32 = f32(max(image_size.width, image_size.height));
    let volume_scale : vec3<f32> = vec3<f32>(f32(image_size.width) / longest_axis, f32(image_size.height) / longest_axis, 1.0);
    var volume_translation : vec3<f32> = vec3<f32>(0, 0, 0) - volume_scale * 0.5;
    output.Position = uniforms.proj_view * vec4<f32>(position * volume_scale + volume_translation, 1.0);
    output.transformed_eye = (uniforms.eye_pos.xyz - volume_translation) / volume_scale;
    output.vray_dir = position - output.transformed_eye;
    return output;
}