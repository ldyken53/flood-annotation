import { Controller } from './ez_canvas_controller';
import { display_2d_vert, display_2d_frag, display_3d_frag, display_3d_vert } from './wgsl';
import { saveAs } from 'file-saver'; 
import axios from 'axios';
import { vec3, mat4 } from "gl-matrix";
import { ArcballCamera } from './arcball_camera';
import math from 'mathjs';
import { elevate } from './elevate';
import { elevate2 } from './elevate2';
import elevate3 from './elevate3.json';

class Renderer {
  public uniform2DBuffer : GPUBuffer | null = null;
  public uniform3DBuffer : GPUBuffer | null = null;
  public device : GPUDevice;
  public bindGroup2D : GPUBindGroup | null = null;
  public colorTexture : GPUTexture | null = null;
  public viewBoxBuffer : GPUBuffer | null = null;
  public terrainToggle : boolean = true;
  public toggleView : boolean = true;
  public colormapImage : HTMLImageElement;
  public outCanvasRef : React.RefObject<HTMLCanvasElement>;
  public canvasSize : [number, number] | null = null;
  public iterRef : React.RefObject<HTMLLabelElement>;
  public frame : (() => void) | undefined;

  constructor(
    adapter : GPUAdapter, device : GPUDevice, 
    canvasRef : React.RefObject<HTMLCanvasElement>, 
    colormap : ImageBitmap, colormapImage : HTMLImageElement,
    outCanvasRef : React.RefObject<HTMLCanvasElement>, 
    fpsRef : React.RefObject<HTMLLabelElement>,
    iterRef : React.RefObject<HTMLLabelElement>,
    satellite : ImageBitmap
  ) {

    console.log(elevate3)
    var etest = elevate3 as number[];
    var eWidth = 4104;
    var eHeight = 1856;
    this.iterRef = iterRef;
    this.colormapImage = colormapImage;
    this.outCanvasRef = outCanvasRef
    this.device = device;
    // Check that canvas is active
    if (canvasRef.current === null) return;
    const context = canvasRef.current.getContext('webgpu')!;
    const defaultEye = vec3.set(vec3.create(), 0.0, 0.0, 1.0);
    const center = vec3.set(vec3.create(), 0.0, 0.0, 0.0);
    const up = vec3.set(vec3.create(), 0.0, 1.0, 0.0);
    var camera = new ArcballCamera(defaultEye, center, up, 4, [
      canvasRef.current.width,
      canvasRef.current.height
    ]);
    const nearPlane = 0.01;
    var proj = mat4.perspective(
        mat4.create(), (50 * Math.PI) / 180.0, canvasRef.current.width / canvasRef.current.height, nearPlane, 1000);
    var projView = mat4.create();
    var controller3D = new Controller();
    controller3D.mousemove = function (prev, cur, evt) {
      if (evt.buttons == 1) {
        camera.rotate(prev, cur);
      } else if (evt.buttons == 2) {
        camera.pan([cur[0] - prev[0], prev[1] - cur[1]]);
      }
    };
    controller3D.wheel = function (amt) {
      camera.zoom(amt * 0.1);
    };
    controller3D.registerForCanvas(canvasRef.current);

    const devicePixelRatio = window.devicePixelRatio || 1;
    const presentationSize = [
      canvasRef.current.clientWidth * devicePixelRatio,
      canvasRef.current.clientHeight * devicePixelRatio,
    ];
    const presentationFormat = context.getPreferredFormat(adapter);
    this.canvasSize = [
      canvasRef.current.width,
      canvasRef.current.height
    ];
  
    context.configure({
      device,
      format: presentationFormat,
      size: presentationSize,
    });

  
    const pipeline = device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: display_2d_vert,
        }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 4 * 4,
            attributes: [
              {
                format: "float32x4" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              }
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({
          code: display_2d_frag,
        }),
        entryPoint: 'main',
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: 4
      }
    });
    var depthFormat = "depth24plus-stencil8" as GPUTextureFormat;
    var depthTexture = device.createTexture({
      size: {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        depthOrArrayLayers: 1,
      },
      format: depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const pipeline3D = device.createRenderPipeline({
      vertex:  {
        module: device.createShaderModule({
          code: display_3d_vert,
        }),
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 3 * 4,
            attributes: [
              {
                format: "float32x3" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({
          code: display_3d_frag,
        }),
        entryPoint: "main",
        targets: [
          {
            format: presentationFormat
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: "front",
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    // Vertices to render
    var dataBuf2D = device.createBuffer({
      size: 6 * 4 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(dataBuf2D.getMappedRange()).set([
      1, -1, 0, 1,  // position
      -1, -1, 0, 1, // position
      -1, 1, 0, 1,   // position
      1, -1, 0, 1,  // position
      -1, 1, 0, 1, // position
      1, 1, 0, 1,   // position
    ]);
    dataBuf2D.unmap();
    var dataBuf3D = device.createBuffer({
      size: 12 * 3 * 3 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(dataBuf3D.getMappedRange()).set([
      1, 0, 0, 0, 0, 0, 1, 1, 0,

      0, 1, 0, 1, 1, 0, 0, 0, 0,

      1, 0, 1, 1, 0, 0, 1, 1, 1,

      1, 1, 0, 1, 1, 1, 1, 0, 0,

      0, 0, 1, 1, 0, 1, 0, 1, 1,

      1, 1, 1, 0, 1, 1, 1, 0, 1,

      0, 0, 0, 0, 0, 1, 0, 1, 0,

      0, 1, 1, 0, 1, 0, 0, 0, 1,

      1, 1, 0, 0, 1, 0, 1, 1, 1,

      0, 1, 1, 1, 1, 1, 0, 1, 0,

      0, 0, 1, 0, 0, 0, 1, 0, 1,

      1, 0, 0, 1, 0, 1, 0, 0, 0,
    ]);
    dataBuf3D.unmap();

    // Set up uniform buffers for bind group
    this.uniform2DBuffer = device.createBuffer({
      size: 6 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.uniform2DBuffer, 0, new Float32Array([0, 0, 1, 1]), 0, 4);
    device.queue.writeBuffer(this.uniform2DBuffer, 4 * 4, new Uint32Array([eWidth, eHeight]), 0, 2);

    this.uniform3DBuffer = device.createBuffer({
      size: 21 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.uniform3DBuffer!, 20 * 4, new Float32Array([0.1]), 0, 1);

    // Load colormap texture
    this.colorTexture = device.createTexture({
      size: [colormap.width, colormap.height, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: colormap },
      { texture: this.colorTexture },
      [colormap.width, colormap.height, 1]
    );
    // Load satellite texture
    var satTexture = device.createTexture({
      size: [satellite.width, satellite.height, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: satellite },
      { texture: satTexture },
      [satellite.width, satellite.height, 1]
    );

    var testBuffer = this.device.createBuffer({
      size: eWidth * eHeight * 4,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    });
    new Float32Array(testBuffer.getMappedRange()).set(etest);
    // new Float32Array(testBuffer.getMappedRange()).set(Array.from({length: eWidth * eHeight}, () => Math.random()));

    testBuffer.unmap();

    this.bindGroup2D = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: satTexture.createView(),
        },
        {
          binding: 1,
          resource: {
            buffer: testBuffer,
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.uniform2DBuffer,
          },
        }
      ],
    });
    var bindGroup3D = device.createBindGroup({
      layout: pipeline3D.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniform3DBuffer,
          },
        },
        {
          binding: 1,
          resource: this.colorTexture.createView(),
        },
        {
          binding: 2,
          resource: {
            buffer: testBuffer,
          }
        },
        {
          binding: 3,
          resource: {
            buffer: this.uniform2DBuffer,
          }
        },
        {
          binding: 4,
          resource: satTexture.createView(),
        },
      ],
    });

    var translation = [0, 0, 1, 1];
    var newTranslation = [0, 0, 1, 1];
    var controller = new Controller();
    var render = this;
    controller.mousemove = function (prev, cur, evt) {
      if (evt.buttons == 1) {
        var change = [(cur[0] - prev[0]) * (translation[2] - translation[0]) / render.canvasSize![0], (prev[1] - cur[1]) * (translation[3] - translation[1]) / render.canvasSize![1]];
        newTranslation = [newTranslation[0] - change[0], newTranslation[1] - change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]]
        if (Math.abs(newTranslation[0] - translation[0]) > 0.03 * (translation[2] - translation[0]) || Math.abs(newTranslation[1] - translation[1]) > 0.03 * (translation[3] - translation[1])) {
          translation = newTranslation;
          device.queue.writeBuffer(render.uniform2DBuffer!, 0, new Float32Array(translation), 0, 4);
        }
      }
    };
    controller.wheel = function (amt) {
      var change = [amt / 1000, amt / 1000];
      newTranslation = [newTranslation[0] + change[0], newTranslation[1] + change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]];
      if (newTranslation[2] - newTranslation[0] > 0.01 && newTranslation[3] - newTranslation[1] > 0.01) {
        translation = newTranslation;
        device.queue.writeBuffer(render.uniform2DBuffer!, 0, new Float32Array(translation), 0, 4);
      } else {
        newTranslation = translation;
      }
    };
    controller.registerForCanvas(canvasRef.current);
    var renderPassDesc : GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadValue: [0.5, 0.5, 0.5, 1],
          storeOp: "store" as GPUStoreOp,
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadValue: 1.0,
        depthStoreOp: "store",
        stencilLoadValue: 0,
        stencilStoreOp: "store",
      },
    };
    const texture = device.createTexture({
      size: presentationSize,
      format: presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: 4
    });
    const view = texture.createView();

    var render = this;
    var frameCount = 0;
    var timeToSecond = 1000;
    this.frame = async function frame() {
        var start = performance.now();
        const commandEncoder = device.createCommandEncoder();
      //   if (timeToSecond == 250) {
      //     var testBuffer = render.device.createBuffer({
      //       size: 224 * 224 * 4,
      //       usage: GPUBufferUsage.STORAGE,
      //       mappedAtCreation: true
      //     });
      //     new Float32Array(testBuffer.getMappedRange()).set(Array.from({length: 224 * 224}, () => Math.random()));
      //     testBuffer.unmap();
      
      //     render.bindGroup2D = device.createBindGroup({
      //       layout: pipeline.getBindGroupLayout(0),
      //       entries: [
      //         {
      //           binding: 0,
      //           resource: render.colorTexture!.createView(),
      //         },
      //         {
      //           binding: 1,
      //           resource: {
      //             buffer: testBuffer,
      //           }
      //         },
      //         {
      //           binding: 2,
      //           resource: {
      //             buffer: render.uniform2DBuffer!,
      //           },
      //         }
      //       ],
      //     });
      // }


        // Sample is no longer the active page.
        if (!canvasRef.current) return;
        if (render.toggleView) {
          renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();
          
          // Compute and upload the combined projection and view matrix
          projView = mat4.mul(projView, proj, camera.camera);
          var upload = device.createBuffer({
            size: 20 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
          });
          var map = new Float32Array(upload.getMappedRange());
          map.set(projView);
          map.set(camera.eyePos(), 16);
          upload.unmap();
          commandEncoder.copyBufferToBuffer(upload, 0, render.uniform3DBuffer!, 0, 20 * 4);
          const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
          if (render.terrainToggle) {
            passEncoder.setPipeline(pipeline3D);
            passEncoder.setVertexBuffer(0, dataBuf3D);
            passEncoder.setBindGroup(0, bindGroup3D);
            passEncoder.draw(12 * 3, 1, 0, 0);
          }
          passEncoder.endPass();
    
          device.queue.submit([commandEncoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        } else {
          const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
              {
                view,
                resolveTarget: context.getCurrentTexture().createView(),
                loadValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                storeOp: "discard" as GPUStoreOp,
              },
            ],
            };
  
          const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
          if (render.terrainToggle) {
            passEncoder.setPipeline(pipeline);
            passEncoder.setVertexBuffer(0, dataBuf2D);
            passEncoder.setBindGroup(0, render.bindGroup2D!);
            passEncoder.draw(6, 1, 0, 0);
          }
          passEncoder.endPass();
    
          device.queue.submit([commandEncoder.finish()]);
          await device.queue.onSubmittedWorkDone();
        }

        var end = performance.now();
        if (timeToSecond - (end - start) < 0) {
          // fpsRef.current!.innerText = `FPS: ${frameCount}`;
          // timeToSecond = 1000 + (timeToSecond - (end - start));
          // frameCount = 0;
          timeToSecond = 250;
        } else {
          timeToSecond -= end - start;
        }
        frameCount += 1;
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(this.frame);

  }

  toggleTerrainLayer() {
    this.terrainToggle = !this.terrainToggle;
  }

  toggle3D() {
    this.toggleView = !this.toggleView;
  }

  setColormap(colormap, colormapImage) {
    this.device.queue.copyExternalImageToTexture(
      { source: colormap },
      { texture: this.colorTexture! },
      [colormap.width, colormap.height, 1]
    );
    this.colormapImage = colormapImage;
  }

  setElevation(e) {
    this.device.queue.writeBuffer(this.uniform3DBuffer!, 20 * 4, new Float32Array([e]), 0, 1);
  }

}
export default Renderer;

