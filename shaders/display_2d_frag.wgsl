// Fragment shader
struct Pixels {
    pixels : array<f32>,
};
struct Uniforms {
    view_box : vec4<f32>,
    width : u32,
    height : u32,
};


@group(0) @binding(0) var myTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> pixels : Pixels;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;

fn outside_grid(p : vec2<u32>) -> bool {
    return any(p <= vec2<u32>(u32(0))) || p.x >= uniforms.width || p.y >= uniforms.height;
}

fn bilinear_interpolate(p : vec2<f32>) -> f32 {
    var pixel_index : u32 = u32(floor(p.x)) + u32(floor(p.y)) * uniforms.width;
    var p11 : f32 = pixels.pixels[pixel_index];
    var p21 : f32 = pixels.pixels[pixel_index + 1u];
    var p12 : f32 = pixels.pixels[pixel_index + uniforms.width];
    var p22 : f32 = pixels.pixels[pixel_index + uniforms.width + 1u];
    var xy1 : f32 = (floor(p.x) + 1.0 - p.x) * p11 + (p.x - floor(p.x)) * p21;
    var xy2 : f32 = (floor(p.x) + 1.0 - p.x) * p12 + (p.x - floor(p.x)) * p22;
    return (floor(p.y) + 1.0 - p.y) * xy1 + (p.y - floor(p.y)) * xy2;
    // return 0.5 * (xy1 + xy2);
}

@fragment
fn main(@location(0) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
    var ufragPos : vec4<u32> = vec4<u32>(fragPosition * f32(uniforms.width));
    if (outside_grid(vec2<u32>(ufragPos.x, ufragPos.y))) {
        discard;
    }
    var pixelIndex : u32 = ufragPos.x + ufragPos.y * uniforms.width;
    // var value : f32 = pixels.pixels[pixelIndex];
    var value : f32 = bilinear_interpolate(vec2<f32>(fragPosition.x * f32(uniforms.width), fragPosition.y * f32(uniforms.width)));
    // var color : vec4<f32> = textureLoad(myTexture, vec2<i32>(i32(value * 180.0), 1), 0);
    var color : vec4<f32> = textureLoad(myTexture, vec2<i32>(ufragPos.xy), 0);
    return color;
}