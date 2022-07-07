export const  display_2d_vert = `// Vertex shader
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


`;
export const  display_2d_frag = `// Fragment shader
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
}`;
export const  display_3d_vert = `// Vertex shader
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
}`;
export const  display_3d_frag = `// Fragment shader
struct Pixels {
    pixels : array<f32>,
};
struct Image {
    view_box : vec4<f32>,
    width : u32,
    height : u32,
};

@group(0) @binding(1) var colormap : texture_2d<f32>;
@group(0) @binding(2) var<storage, read> pixels : Pixels;
@group(0) @binding(3) var<uniform> image_size : Image;
@group(0) @binding(4) var satellite : texture_2d<f32>;

fn intersect_box(orig : vec3<f32>, dir : vec3<f32>, box_min : vec3<f32>, box_max : vec3<f32>) -> vec2<f32> {
    let inv_dir : vec3<f32> = 1.0 / dir;
    let tmin_tmp : vec3<f32> = (box_min - orig) * inv_dir;
    let tmax_tmp : vec3<f32> = (box_max - orig) * inv_dir;
    var tmin : vec3<f32> = min(tmin_tmp, tmax_tmp);
    var tmax : vec3<f32> = max(tmin_tmp, tmax_tmp);
    var t0 : f32 = max(tmin.x, max(tmin.y, tmin.z));
    var t1 : f32 = min(tmax.x, min(tmax.y, tmax.z));
    return vec2<f32>(t0, t1);
}

fn outside_grid(p : vec3<f32>, volumeDims : vec3<f32>) -> bool {
    return any(p < vec3<f32>(0.0)) || any(p >= volumeDims);
}

fn bilinear_interpolate(p : vec3<f32>) -> f32 {
    var pixel_index : u32 = u32(floor(p.x)) + u32(floor(p.y)) * image_size.width;
    var p11 : f32 = pixels.pixels[pixel_index];
    var p21 : f32 = pixels.pixels[pixel_index + 1u];
    var p12 : f32 = pixels.pixels[pixel_index + image_size.width];
    var p22 : f32 = pixels.pixels[pixel_index + image_size.width + 1u];
    var xy1 : f32 = (floor(p.x) + 1.0 - p.x) * p11 + (p.x - floor(p.x)) * p21;
    var xy2 : f32 = (floor(p.x) + 1.0 - p.x) * p12 + (p.x - floor(p.x)) * p22;
    return (floor(p.y) + 1.0 - p.y) * xy1 + (p.y - floor(p.y)) * xy2;
    // return 0.5 * (xy1 + xy2);
}

@fragment
fn main(
  @location(0) vray_dir: vec3<f32>, 
  @location(1) @interpolate(flat) transformed_eye : vec3<f32>
)-> @location(0) vec4<f32> {
    var ray_dir : vec3<f32> = normalize(vray_dir);
    var longest_axis : f32 = f32(max(image_size.width, image_size.height));
    let volume_dims : vec3<f32> = vec3<f32>(f32(image_size.width), f32(image_size.height), f32(longest_axis));
    let vol_eye : vec3<f32> = transformed_eye * volume_dims;
    let grid_ray_dir : vec3<f32> = normalize(ray_dir * volume_dims);


    var t_hit : vec2<f32> = intersect_box(vol_eye, grid_ray_dir, vec3<f32>(0.0), volume_dims - 1.0);
    if (t_hit.x > t_hit.y) { 
        discard;
    }

    t_hit.x = max(t_hit.x, 0.0);

    var p : vec3<f32> = (vol_eye + t_hit.x * grid_ray_dir);
    p = clamp(p, vec3<f32>(0.0), volume_dims - 2.0);
    let inv_grid_ray_dir : vec3<f32> = 1.0 / grid_ray_dir;
    let start_cell : vec3<f32> = floor(p);
    let t_max_neg : vec3<f32> = (start_cell - vol_eye) * inv_grid_ray_dir;
    let t_max_pos : vec3<f32> = (start_cell + 1.0 - vol_eye) * inv_grid_ray_dir;
    let is_neg_dir : vec3<f32> = vec3<f32>(grid_ray_dir < vec3<f32>(0.0));
    // Pick between positive/negative t_max based on the ray sign
    var t_max : vec3<f32> = mix(t_max_pos, t_max_neg, is_neg_dir);
    let grid_step : vec3<i32> = vec3<i32>(sign(grid_ray_dir));
    // Note: each voxel is a 1^3 box on the grid
    let t_delta : vec3<f32> = abs(inv_grid_ray_dir);
    var t_prev : f32 = t_hit.x;
    // Traverse the grid
    loop {
        if (outside_grid(p, volume_dims)) { break; }
        let v000 : vec3<u32> = vec3<u32>(p);
        var pixel_index : u32 = v000.x + v000.y * image_size.width;
        // var value : f32 = pixels.pixels[pixel_index];
        var value : f32 = bilinear_interpolate(p);
        // return vec4<f32>(p.x / volume_dims.x, p.y / volume_dims.y, p.z / volume_dims.z, 1.0);
        // return vec4<f32>(value, value, value, 1.0);
        var compare : f32 = (0.1 * value * longest_axis - f32(v000.z));
        if (0.0 < compare && compare < longest_axis) {
        // if (false) {
            var test : vec4<f32> =  textureLoad(colormap, vec2<i32>(i32(value * 180.0), 1), 0);
            var test2 : vec4<f32> = textureLoad(satellite, vec2<i32>(i32(v000.x), i32(v000.y)), 0);
            return test2;
        }
        // if (value * longest_axis >= f32(v000.z)) {
        //     // return textureLoad(colormap, vec2<i32>(i32(value * 180.0), 1), 0);
        //     return vec4<f32>(value, value, value, 1.0);
        // }

        let t_next : f32 = min(t_max.x, min(t_max.y, t_max.z));
        t_prev = t_next;
        if (t_next == t_max.x) {
            p.x = p.x + f32(grid_step.x);
            t_max.x = t_max.x + t_delta.x;
        } else if (t_next == t_max.y) {
            p.y = p.y + f32(grid_step.y);
            t_max.y = t_max.y + t_delta.y;
        } else {
            p.z = p.z + f32(grid_step.z);
            t_max.z = t_max.z + t_delta.z;
        }
    }
    return vec4<f32>(0.5, 0.5, 0.5, 1.0);
}

`;
