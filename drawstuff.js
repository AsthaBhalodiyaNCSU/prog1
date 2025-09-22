// Full rewrite: raycast rasterizer with many shapes + spacebar toggle
// Usage: include in page with <canvas id="viewport" width="800" height="600"></canvas>
// Call main() after DOM loads (or put script at bottom).

/* -----------------------
   Color class + pixel helper
   ----------------------- */
class Color {
    constructor(r = 0, g = 0, b = 0, a = 255) {
        if (![r,g,b,a].every(c => typeof c === "number")) throw "color component not a number";
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
        this.a = Math.max(0, Math.min(255, a));
    }
    // mutate
    change(r,g,b,a=255) {
        if (![r,g,b,a].every(c => typeof c === "number")) throw "color component not a number";
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
        this.a = Math.max(0, Math.min(255, a));
    }
}

function drawPixel(imagedata, x, y, color) {
    if (typeof x !== 'number' || typeof y !== 'number') {
        console.log("drawpixel location not a number");
        return;
    }
    if (x < 0 || y < 0 || x >= imagedata.width || y >= imagedata.height) {
        // out of bounds - skip silently
        return;
    }
    if (!(color instanceof Color)) {
        console.log("drawpixel color is not a Color");
        return;
    }
    const idx = (y * imagedata.width + x) * 4;
    imagedata.data[idx] = Math.round(color.r);
    imagedata.data[idx+1] = Math.round(color.g);
    imagedata.data[idx+2] = Math.round(color.b);
    imagedata.data[idx+3] = Math.round(color.a);
}

/* -----------------------
   Vector helpers
   ----------------------- */
function v(x,y,z){ return {x:x,y:y,z:z}; }
function vAdd(a,b){ return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
function vSub(a,b){ return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
function vScale(a,s){ return {x:a.x*s, y:a.y*s, z:a.z*s}; }
function vDot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
function vLen(a){ return Math.sqrt(vDot(a,a)); }
function vNorm(a){ let L=vLen(a)||1; return {x:a.x/L,y:a.y/L,z:a.z/L}; }
function vCross(a,b){ return {x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x}; }

/* -----------------------
   Default scene data (fallbacks if fetch fails)
   ----------------------- */
const DEFAULT_LIGHTS = [
    {x:-0.5, y:1.5, z:-0.5, ambient:[0.1,0.1,0.1], diffuse:[1,1,1], specular:[1,1,1]},
    {x: 1.0, y:1.5, z:-0.2, ambient:[0,0,0], diffuse:[0.6,0.6,0.6], specular:[0.6,0.6,0.6]}
];

const DEFAULT_BOXES = [
    { lx:0.15, rx:0.35, by:0.25, ty:0.55, fz:0.0, rz:0.5,
      ambient:[0.05,0.05,0.05], diffuse:[0.8,0.2,0.2], specular:[0.9,0.9,0.9], n:40 },
    { lx:0.6, rx:0.85, by:0.3, ty:0.65, fz:0.0, rz:0.6,
      ambient:[0.02,0.02,0.02], diffuse:[0.2,0.6,0.8], specular:[0.9,0.9,0.9], n:20 }
];

const DEFAULT_ELLIPSOIDS = [
    // each entry: x,y,a,b (2D projection center & radius) plus 3D params for raytrace (center, radii)
    // We'll define 3D ellipsoids with center and radii directly
    { center: {x:0.5, y:0.6, z:0.3}, radii: {x:0.12, y:0.12, z:0.12}, ambient:[0.02,0.02,0.02], diffuse:[0.3,0.8,0.3], specular:[0.9,0.9,0.9], n:30 },
];

const DEFAULT_TRIANGLES = [
    // triangle mesh: each file has a list of vertices (normalized canvas coords & z) and triangles
    {
        vertices: [
            [0.1,0.9,0.1], [0.3,0.7,0.2], [0.2,0.6,0.15]
        ],
        triangles: [[0,1,2]],
        material: { ambient:[0.02,0.02,0.02], diffuse:[0.9,0.8,0.2], specular:[0.8,0.8,0.8], n:10 }
    }
];

/* -----------------------
   Scene object types
   Each object should implement rayIntersect(rayOrigin, rayDir)
   returning either null or an object { t, point, normal, material }
   ----------------------- */

// Sphere/Ellipsoid: represent as center + radii (ellipsoid). Ray intersection by transforming into unit sphere.
class Ellipsoid {
    constructor(center, radii, material){
        this.center = center; // {x,y,z}
        this.radii = radii;   // {x,y,z} (nonzero)
        this.material = material;
    }
    rayIntersect(O, D) {
        // transform ray into ellipsoid local space: scale coordinates by 1/r
        const invR = {x:1/this.radii.x, y:1/this.radii.y, z:1/this.radii.z};
        const Oc = vSub(O, this.center);
        const Oe = {x:Oc.x*invR.x, y:Oc.y*invR.y, z:Oc.z*invR.z};
        const De = {x:D.x*invR.x, y:D.y*invR.y, z:D.z*invR.z};
        const a = vDot(De, De);
        const b = 2 * vDot(De, Oe);
        const c = vDot(Oe, Oe) - 1;
        const disc = b*b - 4*a*c;
        if (disc < 0) return null;
        const sqrtD = Math.sqrt(disc);
        const t0 = (-b - sqrtD) / (2*a);
        const t1 = (-b + sqrtD) / (2*a);
        let t = (t0 > 1e-6) ? t0 : ((t1 > 1e-6) ? t1 : null);
        if (t === null) return null;
        const pLocal = vAdd(O, vScale(D, t));
        const normalRaw = {x:(pLocal.x - this.center.x) / (this.radii.x*this.radii.x),
                           y:(pLocal.y - this.center.y) / (this.radii.y*this.radii.y),
                           z:(pLocal.z - this.center.z) / (this.radii.z*this.radii.z)};
        const normal = vNorm(normalRaw);
        return {t:t, point:pLocal, normal:normal, material:this.material};
    }
}

// Axis-Aligned Box (in normalized scene coordinates)
class AABB {
    constructor(lx, rx, by, ty, fz, rz, material){
        this.lx = lx; this.rx = rx; this.by = by; this.ty = ty; this.fz = fz; this.rz = rz;
        this.material = material;
    }
    rayIntersect(O, D) {
        // slab method; return nearest positive t and face normal
        let tmin = -Infinity, tmax = Infinity;
        let hitNormal = {x:0,y:0,z:0};
        // helper to handle each axis
        function axisCheck(lo, hi, originComp, dirComp, axis) {
            if (Math.abs(dirComp) < 1e-8) {
                if (originComp < lo || originComp > hi) return null; // miss
                return {t1:-Infinity, t2:Infinity, normal:null};
            }
            let t1 = (lo - originComp) / dirComp;
            let t2 = (hi - originComp) / dirComp;
            let n1 = {x:0,y:0,z:0}, n2 = {x:0,y:0,z:0};
            n1[axis] = (dirComp > 0) ? -1 : 1; // normal for entering face
            n2[axis] = (dirComp > 0) ? 1 : -1;  // normal for leaving face
            if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; let tmpn = n1; n1 = n2; n2 = tmpn; }
            return {t1:t1, t2:t2, n1:n1, n2:n2};
        }

        const checks = [
            axisCheck(this.lx, this.rx, O.x, D.x, "x"),
            axisCheck(this.by, this.ty, O.y, D.y, "y"),
            axisCheck(this.fz, this.rz, O.z, D.z, "z")
        ];
        if (checks.some(c=>c===null)) return null;
        // combine
        let localTmin = checks[0].t1, localTminN = checks[0].n1;
        let localTmax = checks[0].t2;
        for (let i=1;i<checks.length;i++){
            if (checks[i].t1 > localTmin) { localTmin = checks[i].t1; localTminN = checks[i].n1; }
            if (checks[i].t2 < localTmax) { localTmax = checks[i].t2; }
            if (localTmax < localTmin) return null;
        }
        if (localTmin < 1e-6) {
            if (localTmax < 1e-6) return null;
            // inside box, set t = localTmax and invert normal
            let t = localTmax;
            // compute exit normal by seeing which axis produced localTmax
            let exitNormal = {x:0,y:0,z:0};
            for (let axis of ["x","y","z"]) {
                const lo = (axis==="x")?this.lx: (axis==="y")?this.by: this.fz;
                const hi = (axis==="x")?this.rx: (axis==="y")?this.ty: this.rz;
                const originComp = O[axis], dirComp = D[axis];
                if (Math.abs(dirComp) > 1e-8) {
                    const t1 = (lo - originComp)/dirComp;
                    const t2 = (hi - originComp)/dirComp;
                    const tmaxAxis = Math.max(t1,t2);
                    if (Math.abs(tmaxAxis - localTmax) < 1e-6) {
                        exitNormal[axis] = (dirComp > 0)? 1 : -1;
                    }
                }
            }
            const point = vAdd(O, vScale(D, t));
            return {t:t, point:point, normal:exitNormal, material:this.material};
        } else {
            const t = localTmin;
            const point = vAdd(O, vScale(D, t));
            return {t:t, point:point, normal:localTminN, material:this.material};
        }
    }
}

// Triangle via Möller–Trumbore
class Triangle {
    constructor(v0, v1, v2, material) {
        this.v0 = v0; this.v1 = v1; this.v2 = v2; this.material = material;
        // precompute normal
        this.edge1 = vSub(this.v1, this.v0);
        this.edge2 = vSub(this.v2, this.v0);
        this.normal = vNorm(vCross(this.edge1, this.edge2));
    }
    rayIntersect(O, D) {
        const EPS = 1e-8;
        const h = vCross(D, this.edge2);
        const a = vDot(this.edge1, h);
        if (Math.abs(a) < EPS) return null; // parallel
        const f = 1.0 / a;
        const s = vSub(O, this.v0);
        const u = f * vDot(s, h);
        if (u < 0.0 || u > 1.0) return null;
        const q = vCross(s, this.edge1);
        const v = f * vDot(D, q);
        if (v < 0.0 || u + v > 1.0) return null;
        const t = f * vDot(this.edge2, q);
        if (t > EPS) {
            const p = vAdd(O, vScale(D, t));
            return {t:t, point:p, normal:this.normal, material:this.material};
        }
        return null;
    }
}

// Infinite plane (optionally finite patch via bounds)
class Plane {
    constructor(pointOnPlane, normal, material, bounds=null) {
        this.p0 = pointOnPlane; // {x,y,z}
        this.normal = vNorm(normal);
        this.material = material;
        // bounds: {uVec, vVec, uMin,uMax, vMin,vMax} for rectangular patch in plane coords
        this.bounds = bounds;
    }
    rayIntersect(O, D) {
        const denom = vDot(this.normal, D);
        if (Math.abs(denom) < 1e-8) return null;
        const t = vDot(vSub(this.p0, O), this.normal) / denom;
        if (t < 1e-6) return null;
        const p = vAdd(O, vScale(D, t));
        if (this.bounds) {
            // compute local coords in plane basis
            const uVec = this.bounds.uVec, vVec = this.bounds.vVec;
            const rel = vSub(p, this.p0);
            const u = vDot(rel, uVec);
            const vcoord = vDot(rel, vVec);
            if (u < this.bounds.uMin || u > this.bounds.uMax || vcoord < this.bounds.vMin || vcoord > this.bounds.vMax) return null;
        }
        return {t:t, point:p, normal:this.normal, material:this.material};
    }
}

// Cylinder (finite, aligned with Y axis)
class Cylinder {
    constructor(center, radius, height, material) {
        this.center = center; // center bottom at y = center.y (or center as base?) we'll take center as base y
        this.radius = radius;
        this.height = height;
        this.material = material;
    }
    rayIntersect(O, D) {
        // Cylinder aligned along Y axis, base at center.y, top at center.y + height
        // Solve quadratic for x,z components: (Ox - Cx + t*Dx)^2 + (Oz - Cz + t*Dz)^2 = r^2
        const ox = O.x - this.center.x, oz = O.z - this.center.z;
        const dx = D.x, dz = D.z;
        const a = dx*dx + dz*dz;
        const b = 2*(ox*dx + oz*dz);
        const c = ox*ox + oz*oz - this.radius*this.radius;
        const disc = b*b - 4*a*c;
        if (disc < 0 || Math.abs(a) < 1e-10) return null;
        const sqrtD = Math.sqrt(disc);
        const t0 = (-b - sqrtD) / (2*a);
        const t1 = (-b + sqrtD) / (2*a);
        let tCandidate = null;
        for (let t of [t0, t1]) {
            if (t < 1e-6) continue;
            const y = O.y + t*D.y;
            if (y >= this.center.y && y <= this.center.y + this.height) { tCandidate = t; break; }
        }
        if (tCandidate === null) {
            // check caps
            // bottom cap y = center.y
            if (Math.abs(D.y) > 1e-8) {
                const tb = (this.center.y - O.y)/D.y;
                if (tb > 1e-6) {
                    const pb = vAdd(O, vScale(D, tb));
                    const dxp = pb.x - this.center.x, dzp = pb.z - this.center.z;
                    if (dxp*dxp + dzp*dzp <= this.radius*this.radius) {
                        return {t:tb, point:pb, normal:{x:0,y:-1,z:0}, material:this.material};
                    }
                }
                const tt = (this.center.y + this.height - O.y)/D.y;
                if (tt > 1e-6) {
                    const pt = vAdd(O, vScale(D, tt));
                    const dxp = pt.x - this.center.x, dzp = pt.z - this.center.z;
                    if (dxp*dxp + dzp*dzp <= this.radius*this.radius) {
                        return {t:tt, point:pt, normal:{x:0,y:1,z:0}, material:this.material};
                    }
                }
            }
            return null;
        }
        const p = vAdd(O, vScale(D, tCandidate));
        const normal = vNorm({x:(p.x - this.center.x), y:0, z:(p.z - this.center.z)});
        return {t:tCandidate, point:p, normal:normal, material:this.material};
    }
}

// Cone (finite, apex at top, aligned Y axis)
class Cone {
    constructor(apex, angle, height, material){
        this.apex = apex; // top point
        this.angle = angle; // in radians (defines slope)
        this.height = height;
        this.material = material;
    }
    rayIntersect(O, D) {
        // Cone opening downwards along -y (apex at apex.y, base at apex.y - height)
        // For simplicity assume axis along negative Y
        // Transform so apex at origin
        const Ox = O.x - this.apex.x, Oy = O.y - this.apex.y, Oz = O.z - this.apex.z;
        const cos2 = Math.cos(this.angle)*Math.cos(this.angle);
        const sin2 = Math.sin(this.angle)*Math.sin(this.angle);
        // Cone equation (x^2 + z^2) - k*y^2 = 0 where k = tan^2(angle)
        const k = Math.tan(this.angle);
        const k2 = k*k;
        const a = D.x*D.x + D.z*D.z - k2*D.y*D.y;
        const b = 2*(Ox*D.x + Oz*D.z - k2*Oy*D.y);
        const c = Ox*Ox + Oz*Oz - k2*Oy*Oy;
        const disc = b*b - 4*a*c;
        if (disc < 0 || Math.abs(a) < 1e-10) return null;
        const sqrtD = Math.sqrt(disc);
        const t0 = (-b - sqrtD)/(2*a);
        const t1 = (-b + sqrtD)/(2*a);
        let tCandidate = null;
        for (let t of [t0, t1]) {
            if (t < 1e-6) continue;
            const y = Oy + t*D.y; // relative y
            // we need apex.y + y in range [apex.y - height, apex.y]
            const worldY = this.apex.y + y;
            if (worldY <= this.apex.y && worldY >= this.apex.y - this.height) { tCandidate = t; break; }
        }
        if (tCandidate === null) return null;
        const p = vAdd(O, vScale(D, tCandidate));
        // compute normal (approx)
        const rel = {x:p.x - this.apex.x, y:p.y - this.apex.y, z:p.z - this.apex.z};
        const n = vNorm({x:rel.x, y:- (Math.sqrt(rel.x*rel.x + rel.z*rel.z)/k), z:rel.z});
        return {t:tCandidate, point:p, normal:n, material:this.material};
    }
}

/* -----------------------
   Scene and renderer
   ----------------------- */
class Scene {
    constructor() {
        this.objects = []; // array of shape instances
        this.lights = DEFAULT_LIGHTS.slice();
        this.background = new Color(0,0,0,255);
        // Simple camera: eye at (0.5,0.5,-0.5) looking toward +z, fov defines ray directions across normalized [0,1] canvas coords
        this.eye = {x:0.5, y:0.5, z:-0.5};
        this.ambientGlobal = 0.05;
    }
    setLights(lights) { this.lights = lights; }
    addObject(obj) { this.objects.push(obj); }
    clearObjects() { this.objects = []; }

    // find nearest intersection
    traceRay(O, D) {
        let closest = null;
        for (let obj of this.objects) {
            const hit = obj.rayIntersect(O,D);
            if (hit && hit.t > 1e-6) {
                if (!closest || hit.t < closest.t) {
                    closest = hit;
                }
            }
        }
        return closest;
    }

    // phong shading given hit record
    shade(hit, viewDir) {
        const m = hit.material;
        // start with ambient
        let r = (m.ambient ? m.ambient[0] : 0) * this.ambientGlobal;
        let g = (m.ambient ? m.ambient[1] : 0) * this.ambientGlobal;
        let b = (m.ambient ? m.ambient[2] : 0) * this.ambientGlobal;
        // per-light
        for (let L of this.lights) {
            // light dir
            const lightDir = vNorm(vSub(v(L.x, L.y, L.z), hit.point));
            // diffuse
            const diff = Math.max(0, vDot(hit.normal, lightDir));
            r += (m.diffuse ? m.diffuse[0] : 0) * (L.diffuse[0] || 1) * diff;
            g += (m.diffuse ? m.diffuse[1] : 0) * (L.diffuse[1] || 1) * diff;
            b += (m.diffuse ? m.diffuse[2] : 0) * (L.diffuse[2] || 1) * diff;
            // specular
            const H = vNorm(vAdd(lightDir, viewDir));
            const specAngle = Math.max(0, vDot(hit.normal, H));
            const shininess = m.n || 10;
            const spec = Math.pow(specAngle, shininess);
            r += (m.specular ? m.specular[0] : 0) * (L.specular[0] || 1) * spec;
            g += (m.specular ? m.specular[1] : 0) * (L.specular[1] || 1) * spec;
            b += (m.specular ? m.specular[2] : 0) * (L.specular[2] || 1) * spec;
        }
        // clamp and convert to 0-255
        return new Color(Math.min(255, r*255), Math.min(255, g*255), Math.min(255, b*255), 255);
    }

    // render to canvas context using raycasting
    renderToContext(context, options={}) {
        const w = context.canvas.width, h = context.canvas.height;
        const imagedata = context.createImageData(w,h);
        // optional: background color fill
        for (let i=0;i<imagedata.data.length;i+=4){
            imagedata.data[i] = this.background.r;
            imagedata.data[i+1] = this.background.g;
            imagedata.data[i+2] = this.background.b;
            imagedata.data[i+3] = this.background.a;
        }

        // iterate pixels
        // We'll shoot a ray from eye through each pixel center in normalized [0,1] coords
        for (let py=0; py<h; py++) {
            for (let px=0; px<w; px++) {
                const ndcX = (px + 0.5) / w;  // normalized device coords 0..1
                const ndcY = 1 - (py + 0.5) / h; // flip Y to match your earlier coordinate system
                // Ray dir: point on view plane at z=0 (as you used earlier)
                const dir = vNorm({x: ndcX - this.eye.x, y: ndcY - this.eye.y, z: 0 - this.eye.z});
                const hit = this.traceRay(this.eye, dir);
                if (hit) {
                    const viewDir = vNorm(vScale(dir, -1));
                    const color = this.shade(hit, viewDir);
                    const idx = (py*w + px)*4;
                    imagedata.data[idx] = color.r;
                    imagedata.data[idx+1] = color.g;
                    imagedata.data[idx+2] = color.b;
                    imagedata.data[idx+3] = color.a;
                }
            }
        }
        context.putImageData(imagedata, 0, 0);
    }
}

/* -----------------------
   Helpers to build scenes from JSON or defaults
   ----------------------- */

// Attempt to fetch a JSON; fall back to fallback value on failure
async function fetchJSON(url, fallback=null) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) { console.log("fetch failed:", url); return fallback; }
        return await resp.json();
    } catch (e) {
        console.log("fetch error for", url, e);
        return fallback;
    }
}

// Build the boxes-only scene (the original image preserved)
function buildBoxesOnlyScene(boxesJson, lightsJson) {
    const scene = new Scene();
    if (lightsJson && Array.isArray(lightsJson) && lightsJson.length>0) scene.setLights(lightsJson);
    scene.clearObjects();
    const boxes = (boxesJson && boxesJson.length) ? boxesJson : DEFAULT_BOXES;
    for (let b of boxes) {
        const mat = {
            ambient: b.ambient || [0.02,0.02,0.02],
            diffuse: b.diffuse || [0.7,0.7,0.7],
            specular: b.specular || [0.6,0.6,0.6],
            n: b.n || 20
        };
        scene.addObject(new AABB(b.lx, b.rx, b.by, b.ty, b.fz, b.rz, mat));
    }
    return scene;
}

// Build full scene with many shapes
function buildFullScene(data) {
    // data can contain: boxes, ellipsoids, triangles, lights, cylinders, cones, planes
    const scene = new Scene();
    const lights = (data.lights && data.lights.length) ? data.lights : DEFAULT_LIGHTS;
    scene.setLights(lights);
    scene.clearObjects();

    // boxes
    const boxes = (data.boxes && data.boxes.length) ? data.boxes : DEFAULT_BOXES;
    for (let b of boxes) {
        const mat = { ambient: b.ambient||[0.02,0.02,0.02], diffuse:b.diffuse||[0.7,0.2,0.2], specular:b.specular||[0.8,0.8,0.8], n:b.n||20 };
        scene.addObject(new AABB(b.lx, b.rx, b.by, b.ty, b.fz, b.rz, mat));
    }

    // ellipsoids
    const ellips = (data.ellipsoids && data.ellipsoids.length) ? data.ellipsoids : DEFAULT_ELLIPSOIDS;
    for (let e of ellips) {
        const mat = { ambient: e.ambient||[0.02,0.02,0.02], diffuse:e.diffuse||[0.6,0.6,0.6], specular:e.specular||[0.8,0.8,0.8], n:e.n||30 };
        scene.addObject(new Ellipsoid(e.center, e.radii, mat));
    }

    // triangles (triangle files)
    const trianglesFiles = (data.triangles && data.triangles.length) ? data.triangles : DEFAULT_TRIANGLES;
    for (let tf of trianglesFiles) {
        const mat = { ambient: tf.material?.ambient || [0.02,0.02,0.02], diffuse: tf.material?.diffuse || [0.8,0.8,0.2], specular: tf.material?.specular || [0.8,0.8,0.8], n: tf.material?.n || 10 };
        // vertices in normalized coords with z provided
        for (let tri of tf.triangles) {
            const v0a = tf.vertices[tri[0]];
            const v1a = tf.vertices[tri[1]];
            const v2a = tf.vertices[tri[2]];
            // map normalized canvas coords to world (x,y preserved; we assume z already given).
            // If user's triangles used normalized coords (0..1), keep same
            const v0 = {x:v0a[0], y:v0a[1], z:(v0a[2] !== undefined ? v0a[2] : 0.2)};
            const v1 = {x:v1a[0], y:v1a[1], z:(v1a[2] !== undefined ? v1a[2] : 0.2)};
            const v2 = {x:v2a[0], y:v2a[1], z:(v2a[2] !== undefined ? v2a[2] : 0.2)};
            scene.addObject(new Triangle(v0,v1,v2,mat));
        }
    }

    // cylinders
    if (data.cylinders) {
        for (let c of data.cylinders) {
            const mat = { ambient:c.ambient||[0.02,0.02,0.02], diffuse:c.diffuse||[0.6,0.6,0.6], specular:c.specular||[0.8,0.8,0.8], n:c.n||15 };
            scene.addObject(new Cylinder(c.center, c.radius, c.height, mat));
        }
    }

    // cones
    if (data.cones) {
        for (let co of data.cones) {
            const mat = { ambient:co.ambient||[0.02,0.02,0.02], diffuse:co.diffuse||[0.7,0.5,0.2], specular:co.specular||[0.8,0.8,0.8], n:co.n||25 };
            scene.addObject(new Cone(co.apex, co.angle, co.height, mat));
        }
    }

    // planes
    if (data.planes) {
        for (let p of data.planes) {
            const mat = { ambient:p.ambient||[0.02,0.02,0.02], diffuse:p.diffuse||[0.6,0.6,0.6], specular:p.specular||[0.2,0.2,0.2], n:p.n||5 };
            // bounds can be provided or null
            let bounds = null;
            if (p.bounds) {
                // p.uVec and p.vVec must be provided as vectors, assume normalized
                bounds = {
                    uVec: p.uVec ? v(p.uVec[0], p.uVec[1], p.uVec[2]) : v(1,0,0),
                    vVec: p.vVec ? v(p.vVec[0], p.vVec[1], p.vVec[2]) : v(0,0,1),
                    uMin: p.uMin, uMax: p.uMax, vMin: p.vMin, vMax: p.vMax
                };
            }
            scene.addObject(new Plane(v(p.point[0], p.point[1], p.point[2]), v(p.normal[0], p.normal[1], p.normal[2]), mat, bounds));
        }
    }

    return scene;
}

/* -----------------------
   Top-level main + toggle behavior
   ----------------------- */
async function main() {
    const canvas = document.getElementById("viewport");
    if (!canvas) {
        console.log("No canvas with id 'viewport' found.");
        return;
    }
    const ctx = canvas.getContext("2d");
    // Fetch JSON inputs (non-blocking awaits). Use fallback defaults on failure.
    // These URLs are the ones used in your original code; if available, they will be used.
    const lightsUrl = "https://ncsucgclass.github.io/prog1/lights.json";
    const ellipsUrl = "https://ncsucgclass.github.io/prog1/ellipsoids.json";
    const trisUrl = "https://ncsucgclass.github.io/prog1/triangles.json";
    const boxesUrl = "https://ncsucgclass.github.io/prog1/boxes.json";
    // other optional URLs not in original but supported:
    const cylUrl = "https://ncsucgclass.github.io/prog1/cylinders.json";
    const coneUrl = "https://ncsucgclass.github.io/prog1/cones.json";
    const planeUrl = "https://ncsucgclass.github.io/prog1/planes.json";

    // fetch concurrently
    const [lightsJson, ellipsJson, trisJson, boxesJson, cylindersJson, conesJson, planesJson] =
        await Promise.all([
            fetchJSON(lightsUrl, DEFAULT_LIGHTS),
            fetchJSON(ellipsUrl, null),
            fetchJSON(trisUrl, null),
            fetchJSON(boxesUrl, null),
            fetchJSON(cylUrl, null),
            fetchJSON(coneUrl, null),
            fetchJSON(planeUrl, null)
        ]);

    // Build two scenes:
    // sceneA = boxes-only (preserve existing image)
    const sceneA = buildBoxesOnlyScene(boxesJson || DEFAULT_BOXES, lightsJson || DEFAULT_LIGHTS);

    // sceneB = full rich scene (use all fetched data if present; else use defaults and some extras)
    const mergedData = {
        lights: lightsJson || DEFAULT_LIGHTS,
        boxes: boxesJson || DEFAULT_BOXES,
        ellipsoids: ellipsJson || DEFAULT_ELLIPSOIDS,
        triangles: trisJson || DEFAULT_TRIANGLES,
        cylinders: cylindersJson || [],
        cones: conesJson || [],
        planes: planesJson || []
    };

    // If ellipsJson is non-null but in original format (a/b/x/y) transform to center+radii
    if (ellipsJson && Array.isArray(ellipsJson)) {
        mergedData.ellipsoids = [];
        for (let e of ellipsJson) {
            // original ellipsoid JSON used fields: x,y,z? or x,y,a,b? We'll attempt to handle common shapes:
            if (e.center && e.radii) {
                mergedData.ellipsoids.push({ center: e.center, radii: e.radii, diffuse: e.diffuse, ambient: e.ambient, specular: e.specular, n: e.n });
            } else {
                // fallback: use x,y and given a,b with some z
                const cx = (e.x !== undefined) ? e.x : (e.cx !== undefined ? e.cx : 0.5);
                const cy = (e.y !== undefined) ? e.y : (e.cy !== undefined ? e.cy : 0.5);
                const cz = (e.z !== undefined) ? e.z : 0.2;
                const a = (e.a !== undefined) ? e.a : (e.rx !== undefined ? e.rx : 0.1);
                const b = (e.b !== undefined) ? e.b : (e.ry !== undefined ? e.ry : a);
                // set radii z same as min(a,b) for reasonable shape
                mergedData.ellipsoids.push({ center: {x:cx, y:cy, z:cz}, radii: {x:a, y:b, z:Math.min(a,b)}, diffuse:e.diffuse||[0.7,0.7,0.7], ambient:e.ambient, specular:e.specular, n:e.n });
            }
        }
    }

    // build sceneB
    const sceneB = buildFullScene(mergedData);

    // initial render: preserve the image as it is (boxes-only)
    let currentScene = sceneA;
    currentScene.renderToContext(ctx);

    // toggle logic on spacebar
    window.addEventListener('keydown', function(ev) {
        if (ev.code === 'Space') {
            ev.preventDefault();
            currentScene = (currentScene === sceneA) ? sceneB : sceneA;
            // render (synchronous)
            currentScene.renderToContext(ctx);
        }
    });

    // Optional: draw a small instruction
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("Press Spacebar to toggle scenes (boxes ↔ all shapes)", 10, 20);
}

// if you want auto-run when script included at bottom:
// window.onload = main;

// Export for callers
if (typeof window !== 'undefined') window.rayMain = main;


