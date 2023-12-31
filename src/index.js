import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import * as DAT from 'lil-gui'
import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger';
import { PointerLockControlsCannon_Modified } from './PointerLockControlsCannon_Modified.js'
import { gsap } from 'gsap/gsap-core';

import './upload.js'

const canvas = document.querySelector('canvas.webgl')
const fileInput = document.getElementById("fileInput");

//FILE HANDLER
fileInput.addEventListener("change", async (event) => {
  // Get the selected file
  const selectedFile = fileInput.files[0]; // Get the selected file
  createPainting(selectedFile)
});

let currPainting
let currPainting_grp = new THREE.Group()

const createPainting = async (selectedFile) => {
  if (selectedFile) {
    const img = new Image();
    img.src = URL.createObjectURL(selectedFile); // Load the selected image
    img.onload = function () {
      const width = this.width;
      const height = this.height;

      console.log('Image width:', width, 'Image height:', height);


      // Create a file loader
      const loader = new THREE.FileLoader();
      loader.setResponseType("blob");

      // Load the blob URL
      loader.load(
        img.src, // the blob URL from the previous example
        async (data) => {
          // Create a blob URL from the data
          const url = URL.createObjectURL(data);

          // Create a texture loader

          // Load the texture from the blob URL
          const texture = textureLoader.load(url);


          const geo = new THREE.BoxGeometry(width * .005, height * .005, .5)
          const material = new THREE.MeshStandardMaterial({ map: texture });
          currPainting = new THREE.Mesh(geo, material)
          contactWalls.push(currPainting)
          currPainting_grp.add(currPainting)
          // currPainting_grp.position.setY(height * .0025)
          // currPainting.rotateY(Math.PI / 2)
          currPainting.material.color.add(new THREE.Color(0xffff00))
          scene.add(currPainting_grp)
          canvas.addEventListener('pointermove', onPointerMove);
          canvas.addEventListener('click', handleSelection)
        },
        undefined,
        function (error) {
          // Handle any errors
          console.error(error);
        }
      );

    };
  }
}

const handleSelection = (event) => {

  const closestObject = intersects.reduce((minDistanceObj, currentObj) => {
    return currentObj.distance < minDistanceObj.distance ? currentObj : minDistanceObj;
  }, intersects[0]); // Set the initial value to the first object

  raycaster.setFromCamera(pointer, camera);
  intersects = raycaster.intersectObjects(contactWalls)

  //Select Painting
  if (closestObject.object.name === '' && currPainting_grp.children.length === 0) {

    currPainting = closestObject.object

    currPainting.material.color.add(new THREE.Color(0xffff00))
    const worldPOS = new THREE.Vector3()
    currPainting.getWorldPosition(worldPOS)
    currPainting.position.set(0,0,0)
    currPainting_grp.add(currPainting)
    currPainting_grp.position.copy(worldPOS)   

    // currPainting_grp.position.copy(currPainting.position)

    // const offset = new THREE.Vector3()
    // offset.subVectors()
  }

  // Plot Painting
  else if (currPainting instanceof THREE.Mesh && currPainting_grp.children.length > 0) {
    // const clonedPainting = currPainting.clone()
    currPainting_grp.position.copy(intersects[0].point)
    scene.add(currPainting)
    currPainting.position.copy(currPainting_grp.position)
    currPainting.rotation.copy(currPainting_grp.rotation)
    console.log(currPainting.geometry.attributes, intersects[0].face.normal)
    // currPainting.geometry.attributes.normal  = intersects[0].face.normal
    currPainting_grp.position.set(0,0,0)
    currPainting.material.color = new THREE.Color(1, 1, 1)
   
    // scene.remove(currPainting)
    // currPainting = undefined
  }

  // canvas.removeEventListener('click', handleSelection)
}

const onPointerMove = (event) => {

  pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  pointer.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  intersects = raycaster.intersectObjects(contactWalls)

  // Constain Canvas to Pointer Coordinates
  if (currPainting_grp.children.length > 0) {
   

    for (const intersect of intersects) {
      currPainting_grp.position.set(0, 0, 0);
      currPainting_grp.lookAt(intersect.face.normal);
      currPainting.lookAt(intersect.face.normal);
      currPainting_grp.position.copy(intersect.point);
    }
  }
}

let bench_grp
let white_wall_grp
let contactWalls = []
let color_wall_grp
let light_grp
let stands_grp
let floor_grp
let trim_grp
let iron_grid_grp
let sphereBody
let physicsMaterial
let currPercentageValue = 0

const timeStep = 1 / 60
let lastCallTime = performance.now() / 1000
const clock = new THREE.Clock()
const scene = new THREE.Scene()
const gui = new DAT.GUI()
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.y = 4.5

//OVERLAY
const overlayGeometery = new THREE.PlaneGeometry(2, 2, 1, 1,)
const overlayMaterial = new THREE.ShaderMaterial({
  transparent: true,

  uniforms: {
    uAlpha: { value: 1.0 }
  },
  vertexShader: `
  void main () {
    gl_Position = vec4(position, 1.0);
  }`,
  fragmentShader: `
  uniform float uAlpha;
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
  }`
})
const overlay = new THREE.Mesh(overlayGeometery, overlayMaterial)
scene.add(overlay)
// camera.lookAt(overlay)

//CANNON WORLD
const cannonPhysics = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
})

physicsMaterial = new CANNON.Material('physics')
const physics_physics = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
  friction: 0.0,
  restitution: 0.3,
})

// We must add the contact materials to the world
cannonPhysics.addContactMaterial(physics_physics)

const renderer = new THREE.WebGLRenderer({
  canvas
})

///
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let intersects = []

//LOADERS
const loadingManager = new THREE.LoadingManager(
  //Loaded
  () => {
    console.log("Done Loading!")
    scene.add(controls.getObject())
    overlayMaterial.uniforms.uAlpha = 0.0

    gsap.delayedCall(.5, () => {
      loadingBarElement.style.transform = ``
      loadingPercentageElement.style.opacity = 0
      loadingBarElement.classList.add('ended')
      cannonPhysics.addBody(sphereBody)
    })
  },
  //Progress
  (itemsURL, itemsLoaded, itemsTotal) => {
    const progressRatio = itemsLoaded / itemsTotal
    if (progressRatio > currPercentageValue) {
      currPercentageValue = progressRatio
      currPercentageValue = progressRatio
      loadingBarElement.style.transform = `scaleX(${progressRatio})`
      loadingPercentageElement.textContent = `${(progressRatio * 100).toFixed(0)}%`;

    } else {
      return
    }

  }
)
const gltfLoader = new GLTFLoader(loadingManager)
const textureLoader = new THREE.TextureLoader(loadingManager)
const rgbeLoader = new RGBELoader(loadingManager)

const loadingBarElement = document.querySelector(".loading-bar")
const loadingPercentageElement = document.querySelector(".loading-percentage")

// ENVIRONMENT
rgbeLoader.load('/environments/kloofendal_48d_partly_cloudy_puresky_2k.hdr', (envMap) => {
  envMap.mapping = THREE.EquirectangularReflectionMapping

  scene.background = envMap
  scene.environment = envMap
})

//LIGHTMAPS
//BENCHES
const bench_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_00_bench_00Shape.jpg')
const bench_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_01_bench_01Shape.jpg')
const bench_lightmap_02 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_02_bench_02Shape.jpg')
const bench_lightmap_03 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_03_bench_03Shape.jpg')
const bench_lightmap_04 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_04_bench_04Shape.jpg')
const bench_lightmap_05 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_05_bench_05Shape.jpg')
const bench_lightmap_06 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Bench_grp_bench_06_bench_06Shape.jpg')

bench_lightmap_00.flipY = false
bench_lightmap_01.flipY = false
bench_lightmap_02.flipY = false
bench_lightmap_03.flipY = false
bench_lightmap_04.flipY = false
bench_lightmap_05.flipY = false
bench_lightmap_06.flipY = false

//FLOORS
const floor_hallway_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Floor_grp_Floor_Hallway_00_Floor_Hallway_Shape0.jpg')
const floor_hallway_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Floor_grp_Floor_Hallway_01_Floor_Hallway_Shape1.jpg')
const floor_outside_lightmap_03 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Floor_grp_Floor_Outside_03_Floor_Outside_Shape3.jpg')
const floor_wooden_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Floor_grp_Floor_Wooden_00_Floor_Wooden_Shape0.jpg')
const floor_wooden_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Floor_grp_Floor_Wooden_01_Floor_Wooden_Shape1.jpg')

floor_hallway_lightmap_00.flipY = false
floor_hallway_lightmap_01.flipY = false
floor_outside_lightmap_03.flipY = false
floor_wooden_lightmap_00.flipY = false
floor_wooden_lightmap_01.flipY = false

//WHITE WALLS
const white_wall_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_00_White_Wall_Shape0.jpg')
const white_wall_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_01_White_Wall_Shape1.jpg')
const white_wall_lightmap_02 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_02_White_Wall_02Shape.jpg')
const white_wall_lightmap_03 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_03_White_Wall_Shape3.jpg')
const white_wall_lightmap_04 = textureLoader.load('./models/gltf/Azul_36/Azul_40__White_Wall_grp_White_Wall_04_White_Wall_Shape4.jpg')
const white_wall_lightmap_05 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_05_White_Wall_Shape5.jpg')
const white_wall_lightmap_06 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_white_Wall_06_white_Wall_Shape6.jpg')
const white_wall_lightmap_07 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Wall_07_White_Wall_07Shape.jpg')
const white_ceiling_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Ceiling_00_White_Ceiling_Shape0.jpg')
const white_ceiling_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Ceiling_01_White_Ceiling_Shape1.jpg')
const white_ceiling_lightmap_02 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Ceiling_02_White_Ceiling_Shape2.jpg')
const white_ceiling_lightmap_03 = textureLoader.load('./models/gltf/Azul_36/Azul_36__White_Wall_grp_White_Ceiling_03_White_Ceiling_Shape3.jpg')

white_wall_lightmap_00.flipY = false
white_wall_lightmap_01.flipY = false
white_wall_lightmap_02.flipY = false
white_wall_lightmap_03.flipY = false
white_wall_lightmap_04.flipY = false
white_wall_lightmap_05.flipY = false
white_wall_lightmap_06.flipY = false
white_wall_lightmap_07.flipY = false
white_ceiling_lightmap_00.flipY = false
white_ceiling_lightmap_01.flipY = false
white_ceiling_lightmap_02.flipY = false
white_ceiling_lightmap_03.flipY = false

//COLOR WALLS
const color_wall_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_01_Color_Walls_01Shape.jpg')
const color_wall_lightmap_02 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_02_Color_Walls_02Shape.jpg')
const color_wall_lightmap_03 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_03_Color_Walls_Shape3.jpg')
const color_wall_lightmap_04 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_04_Color_Walls_04Shape.jpg')
const color_wall_lightmap_06 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_06_Color_Walls_Shape6.jpg')
const color_wall_lightmap_07 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_07_Color_Walls_Shape7.jpg')
const color_wall_lightmap_08 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Color_Wall_grp_Color_Walls_08_Color_Walls_08Shape.jpg')


color_wall_lightmap_01.flipY = false
color_wall_lightmap_02.flipY = false
color_wall_lightmap_03.flipY = false
color_wall_lightmap_04.flipY = false
color_wall_lightmap_06.flipY = false
color_wall_lightmap_07.flipY = false
color_wall_lightmap_08.flipY = false

//STANDS
const stand_white_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Stands_grp_Stand_White_00_Stand_White_00Shape.jpg')
const stand_metal_lightmap_01 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Stands_grp_Stand_Metal_00_Stand_Metal_00Shape.jpg')

stand_white_lightmap_00.flipY = false
stand_metal_lightmap_01.flipY = false

//TRIMS
const trim_lightmap_00 = textureLoader.load('./models/gltf/Azul_36/Azul_36__Trim_grp_trim_0_trim_0Shape.jpg')

trim_lightmap_00.flipY = false

//TEXTURES
const bench_albedo = textureLoader.load('./textures/plywood_diff_2k.jpg')
const bench_nor = textureLoader.load('./textures/plywood_nor_gl_2k.jpg')
const floor_outside_albedo = textureLoader.load('./textures/square_concrete_pavers_diff_2k.jpg')
const floor_hallway_albedo = textureLoader.load('./textures/large_floor_tiles_02_diff_2k.jpg')
const floor_wooden_albedo = textureLoader.load('./textures/wood_floor_deck_diff_2k.jpg', (texture) => {
})

floor_wooden_albedo.wrapS = THREE.RepeatWrapping
floor_wooden_albedo.wrapT = THREE.RepeatWrapping
floor_outside_albedo.wrapS = THREE.RepeatWrapping
floor_outside_albedo.wrapT = THREE.RepeatWrapping
floor_hallway_albedo.wrapS = THREE.RepeatWrapping
floor_hallway_albedo.wrapT = THREE.RepeatWrapping


const floor_wooden_nor = textureLoader.load('./textures/wood_floor_deck_nor_gl_2k.jpg')

const log = () => {
  const test = new THREE.Vector3
  controls.getObject().getWorldDirection(test)
  console.log(test)
}

//MATERIALS
const bench_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_00 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_01 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_02_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_02 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_03_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_03 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_04_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_04 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_05_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_05 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const bench_06_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: bench_lightmap_06 },
    texture2: { value: bench_albedo },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});

const floor_hallway_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: floor_hallway_lightmap_00 },
    texture2: { value: floor_hallway_albedo },
    textureRepeat: { value: 10.0 }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform float textureRepeat;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv * textureRepeat);
        gl_FragColor = color1 * color2;
      }
    `,
});
const floor_outside_03_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: floor_outside_albedo },
    texture2: { value: floor_outside_lightmap_03 },
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv);
        gl_FragColor = color1 * color2;
      }
    `,
});
const floor_hallway_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: floor_hallway_lightmap_01 },
    texture2: { value: floor_hallway_albedo },
    textureRepeat: { value: 10.0 }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform float textureRepeat;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv * textureRepeat);
        gl_FragColor = color1 * color2;
      }
    `,
});
const floor_wooden_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: floor_wooden_lightmap_00 },
    texture2: { value: floor_wooden_albedo },
    textureRepeat: { value: 10.0 },
    normalMap: { value: floor_wooden_nor }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform float textureRepeat;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv * textureRepeat);
        gl_FragColor = color1 * color2;
      }
    `,
});
const floor_wooden_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: floor_wooden_lightmap_01 },
    texture2: { value: floor_wooden_albedo },
    textureRepeat: { value: 10.0 },
    normalMap: { value: floor_wooden_nor }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;

      uniform float textureRepeat;
      varying vec2 vUv;
      void main() {

        vec4 normalColor = texture2D(normalMap, vUv * textureRepeat);

        // Calculate the perturbed normal
        vec3 perturbedNormal = normalize(normalColor.xyz * 2.0 - 1.0);
       
        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv * textureRepeat);
        
        gl_FragColor = color1 * color2;
      }
    `,
});

const white_wall_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_00 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_01 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_02_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_02 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_03_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_03 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_04_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_04 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_05_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_05 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_wall_06_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_06 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) },
    brightness: { value: 1.3 },
    colorCorrect: { value: new THREE.Vector4(0.0, 0.0, 0.0, 0.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform float brightness;  
      uniform vec4 colorCorrect;  
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);        
        gl_FragColor = ((color1 * brightness) - colorCorrect)* colorBase;
      }
    `,
});
white_wall_06_material.side = THREE.DoubleSide
const white_wall_07_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_wall_lightmap_07 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});

const white_ceiling_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_ceiling_lightmap_00 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_ceiling_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_ceiling_lightmap_01 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_ceiling_02_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_ceiling_lightmap_02 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const white_ceiling_03_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: white_ceiling_lightmap_03 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
white_ceiling_00_material.side = THREE.DoubleSide
white_ceiling_01_material.side = THREE.DoubleSide
white_ceiling_02_material.side = THREE.DoubleSide
white_ceiling_03_material.side = THREE.DoubleSide

const color_wall_01_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_01 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor =  color1 * colorBase;
      }
    `,
});
const color_wall_02_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_02 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const color_wall_03_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_03 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const color_wall_04_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_04 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const color_wall_06_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_06 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const color_wall_07_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_07 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});
const color_wall_08_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: color_wall_lightmap_08 },
    colorBase: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }

  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D normalMap;
      uniform vec4 colorBase;
     
      varying vec2 vUv;
      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        
        
        gl_FragColor = color1 * colorBase;
      }
    `,
});

const trim_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: trim_lightmap_00 },
    texture2: { value: floor_wooden_albedo }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;     
      varying vec2 vUv;

      void main() {

        vec4 color1 = texture2D(texture1, vUv);
        vec4 color2 = texture2D(texture2, vUv * 15.0);        
        gl_FragColor = color1 * color2;
      }
    `,
});

const stand_white_00_material = new THREE.ShaderMaterial({
  uniforms: {
    texture1: { value: stand_white_lightmap_00 },
    baseColor: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }
  },
  vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  fragmentShader: `
      uniform sampler2D texture1;
      uniform sampler2D texture2;   
      uniform vec4 baseColor;  
      varying vec2 vUv;

      void main() {

        vec4 color1 = texture2D(texture1, vUv);      
        gl_FragColor = color1 * baseColor;
      }
    `,
});



let debugFunc = { log }
gui.add(debugFunc, "log")

//MODELS
gltfLoader.load('./models/gltf/Azul_36/Azul_01.gltf', (gltf) => {
  gltf.scene.traverse(group => {
    if (group.name === "Bench_grp") {
      bench_grp = group
    } else if (group.name === "White_Wall_grp") {
      white_wall_grp = group
    } else if (group.name === "Color_Wall_grp") {
      color_wall_grp = group
    } else if (group.name === "Lights_grp") {
      light_grp = group
    } else if (group.name === "Stands_grp") {
      stands_grp = group
    } else if (group.name === "Floor_grp") {
      floor_grp = group
    } else if (group.name === "Iron_Grid_grp") {
      iron_grid_grp = group
    } else if (group.name === "Trim_grp") {
      trim_grp = group
    }
  })

  bench_grp.traverse((bench) => {
    if (bench.name === "bench_00PIV") {
      bench.material = bench_00_material
    } else if (bench.name === "bench_01PIV") {
      bench.material = bench_01_material
    } else if (bench.name === "bench_02PIV") {
      bench.material = bench_02_material
    } else if (bench.name === "bench_03PIV") {
      bench.material = bench_03_material
    } else if (bench.name === "bench_04PIV") {
      bench.material = bench_04_material
    } else if (bench.name === "bench_05PIV") {
      bench.material = bench_05_material
    } else if (bench.name === "bench_06PIV") {
      bench.material = bench_06_material
    }
  });

  floor_grp.traverse((floor) => {
    // console.log(floor.name)
    if (floor.name === "Floor_Hallway_00") {
      floor_hallway_00_material.needsUpdate = true
      floor.material = floor_hallway_00_material
    } else if (floor.name === "Floor_Hallway_01") {
      floor.material = floor_hallway_01_material
    } else if (floor.name === "Floor_Outside_03") {
      floor.material = floor_outside_03_material
    } else if (floor.name === "Floor_Wooden_00") {
      floor_wooden_00_material.needsUpdate = true

      floor.material = floor_wooden_00_material
    } else if (floor.name === "Floor_Wooden_01") {
      floor.material = floor_wooden_01_material
    }
  });
  white_wall_grp.traverse((wall) => {

    if (wall.name === "White_Wall_00") {

      wall["children"][0].material = white_wall_00_material
    } else if (wall.name === "White_Wall_01") {
      wall.material = white_wall_01_material
    } else if (wall.name === "White_Wall_02") {

      wall["children"][0].material = white_wall_02_material
    } else if (wall.name === "White_Wall_03") {

      wall["children"][0].material = white_wall_03_material
    } else if (wall.name === "White_Wall_04") {
      wall["children"][0].material = white_wall_04_material
    } else if (wall.name === "White_Wall_05") {
      wall.material = white_wall_05_material
    } else if (wall.name === "white_Wall_06") {
      wall.material = white_wall_06_material
    } else if (wall.name === "White_Wall_07") {
      wall["children"][0].material = white_wall_07_material
    } else if (wall.name === "White_Ceiling_00") {
      wall.material = white_ceiling_00_material
    } else if (wall.name === "White_Ceiling_01") {
      wall.material = white_ceiling_01_material
    } else if (wall.name === "White_Ceiling_02") {
      wall.material = white_ceiling_02_material
    } else if (wall.name === "White_Ceiling_03") {
      wall.material = white_ceiling_03_material
    }
  });
  color_wall_grp.traverse((colorWall) => {

    if (colorWall.name === "Color_Walls_01") {
      colorWall["children"][0].material = color_wall_01_material
      // contactWalls.push(colorWall)
    } else if (colorWall.name === "Color_Walls_02") {
      // contactWalls.push(colorWall)
      colorWall["children"][0].material = color_wall_02_material
      // contactWalls.push(colorWall)
    } else if (colorWall.name === "Color_Walls_03") {
      // contactWalls.push(colorWall)
      colorWall["children"][0].material = color_wall_03_material
    } else if (colorWall.name === "Color_Walls_04") {
      // contactWalls.push(colorWall)
      colorWall["children"][0].material = color_wall_04_material
    } else if (colorWall.name === "Color_Walls_06") {
      // contactWalls.push(colorWall)
      colorWall.material = color_wall_06_material
    } else if (colorWall.name === "Color_Walls_07") {
      // contactWalls.push(colorWall)
      colorWall.material = color_wall_07_material
    } else if (colorWall.name === "Color_Walls_08") {
      // contactWalls.push(colorWall)
      colorWall["children"][0].material = color_wall_08_material
    }
  });
  trim_grp.traverse(trim => {
    if (trim.isMesh) trim.material = trim_00_material
  })


  stands_grp.traverse(stand => {
    if (stand.name === "Stand_Metal_00PIV") {

    } else if (stand.name === "Stand_White_00PIV") {
      stand.material = stand_white_00_material
    }
  })

  scene.add(iron_grid_grp, bench_grp, white_wall_grp, color_wall_grp, light_grp, stands_grp, floor_grp, trim_grp)

  contactWalls.push(color_wall_grp, white_wall_grp)

  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane,
  })
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  cannonPhysics.addBody(floorBody)
})

sphereBody = new CANNON.Body({
  mass: 5,
  shape: new CANNON.Sphere(.5),
  position: new CANNON.Vec3(9, 3, -9),
  material: physicsMaterial
})
sphereBody.linearDamping = 0.9
sphereBody.position.y = 8
// cannonPhysics.addBody(sphereBody)



const controls = new PointerLockControlsCannon_Modified(camera, sphereBody, canvas)
// const controls = new PointerLockControlsCannon(camera, sphereBody)
controls.enabled = true

// controls.unlock()
// scene.add(controls.getObject())


// CANNON DEBUGGER
// const cannonDebugger = new CannonDebugger(scene, cannonPhysics)

const axesHelper = new THREE.AxesHelper(100);

// scene.add(axesHelper)

//LIGHTS
const ambLight = new THREE.AmbientLight()
scene.add(ambLight)

renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

window.addEventListener('resize', () => {

  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})




const tick = () => {



  const elapsedTime = clock.getElapsedTime()
  const time = performance.now() / 1000
  const dt = time - lastCallTime
  lastCallTime = time

  if (controls.enabled) {
    cannonPhysics.step(timeStep, dt)

  }
  // cannonDebugger.update()

  // cannonPhysics.fixedStep()
  controls.update(dt)
  renderer.render(scene, camera)

  window.requestAnimationFrame(tick)
}
tick()