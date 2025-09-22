/* classes */ 

// Color constructor
class Color {
    constructor(r,g,b,a) {
        try {
            if ((typeof(r) !== "number") || (typeof(g) !== "number") || (typeof(b) !== "number") || (typeof(a) !== "number"))
                throw "color component not a number";
            else if ((r<0) || (g<0) || (b<0) || (a<0)) 
                throw "color component less than 0";
            else if ((r>255) || (g>255) || (b>255) || (a>255)) 
                throw "color component bigger than 255";
            else {
                this.r = r; this.g = g; this.b = b; this.a = a; 
            }
        } 
        catch (e) {
            console.log(e);
        }
    } 

    // Color change method
    change(r,g,b,a) {
        try {
            if ((typeof(r) !== "number") || (typeof(g) !== "number") || (typeof(b) !== "number") || (typeof(a) !== "number"))
                throw "color component not a number";
            else if ((r<0) || (g<0) || (b<0) || (a<0)) 
                throw "color component less than 0";
            else if ((r>255) || (g>255) || (b>255) || (a>255)) 
                throw "color component bigger than 255";
            else {
                this.r = r; this.g = g; this.b = b; this.a = a; 
            }
        } 
        catch (e) {
            console.log(e);
        }
    }
} // end color class


/* utility functions */
function getInputLights() {
	const light = [
        {"x": -0.5, "y": 1.5, "z": -0.5, "ambient": [1,1,1], "diffuse": [1,1,1], "specular": [1,1,1]}
    ];
    return light;
}

// draw a pixel at x,y using color
function drawPixel(imagedata,x,y,color) {
    try {
        if ((typeof(x) !== "number") || (typeof(y) !== "number"))
            throw "drawpixel location not a number";
        else if ((x<0) || (y<0) || (x>=imagedata.width) || (y>=imagedata.height))
            throw "drawpixel location outside of image";
        else if (color instanceof Color) {
            var pixelindex = (y*imagedata.width + x) * 4;
            imagedata.data[pixelindex] = color.r;
            imagedata.data[pixelindex+1] = color.g;
            imagedata.data[pixelindex+2] = color.b;
            imagedata.data[pixelindex+3] = color.a;
        } else 
            throw "drawpixel color is not a Color";
    } 
    catch(e) {
        console.log(e);
    }
} 

// ========== Existing functions unchanged (drawRandPixels, ellipsoids, triangles, etc.) ==========
// (I’m not pasting them again here for brevity, but in your final file, keep all unchanged.)

// ----------------------------- NEW / FIXED PARTS ---------------------------------

// FIX small bug in JSON loaders (console.log* → console.log)
function getInputEllipsoids() {
    const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog1/ellipsoids.json";
    var httpReq = new XMLHttpRequest();
    httpReq.open("GET",INPUT_ELLIPSOIDS_URL,false);
    httpReq.send(null); 
    var startTime = Date.now();
    while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now()-startTime) > 3000) break;
    }
    if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) {
        console.log("Unable to open input ellipses file!");
        return String.null;
    } else
        return JSON.parse(httpReq.response); 
}

function getInputTriangles() {
    const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog1/triangles.json";
    var httpReq = new XMLHttpRequest();
    httpReq.open("GET",INPUT_TRIANGLES_URL,false);
    httpReq.send(null); 
    var startTime = Date.now();
    while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now()-startTime) > 3000) break;
    }
    if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) {
        console.log("Unable to open input triangles file!");
        return String.null;
    } else
        return JSON.parse(httpReq.response); 
}

function getInputBoxes() {
    const INPUT_BOXES_URL = "https://ncsucgclass.github.io/prog1/boxes.json";
    var httpReq = new XMLHttpRequest();
    httpReq.open("GET",INPUT_BOXES_URL,false);
    httpReq.send(null); 
    var startTime = Date.now();
    while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now()-startTime) > 3000) break;
    }
    if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE)) {
        console.log("Unable to open input boxes file!");
        return String.null;
    } else
        return JSON.parse(httpReq.response); 
}

// --------------- YOUR NEW FUNCTION (Raytraced Random Pixels in Boxes) ---------------
function drawRandPixelsInInputBoxes(context) {
    var inputBoxes = getInputBoxes();
    var inputLights = getInputLights();
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w,h);

    // initialize black background
    for (let i = 0; i < imagedata.data.length; i += 4) {
        imagedata.data[i]   = 0;
        imagedata.data[i+1] = 0;
        imagedata.data[i+2] = 0;
        imagedata.data[i+3] = 255;
    }

    if (inputBoxes != String.null && inputLights != String.null) { 
        var n = inputBoxes.length;
        var eye = {x:0.5, y:0.5, z:-0.5};    // camera position

        // normalize vector
        function normalize(v) {
            let len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
            return {x:v.x/len, y:v.y/len, z:v.z/len};
        }

        // dot product
        function dot(a,b) { return a.x*b.x + a.y*b.y + a.z*b.z; }

        // Loop over every pixel
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                
                // normalized coords [0,1], flip y-axis
                let ndcX = px / w;
                let ndcY = 1 - (py / h);

                // ray direction
                let dx = ndcX - eye.x;
                let dy = ndcY - eye.y;
                let dz = 0 - eye.z;
                let len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                dx /= len; dy /= len; dz /= len;

                let closestT = Infinity;
                let hitBox = null;
                let hitPoint = null;
                let hitNormal = null;

                // check each box
                for (let b=0; b<n; b++) {
                    let box = inputBoxes[b];
                    let result = rayIntersectBox(eye, {x:dx,y:dy,z:dz}, box);
                    if (result && result.t < closestT) {
                        closestT = result.t;
                        hitBox = box;
                        hitPoint = result.point;
                        hitNormal = result.normal;
                    }
                }

                if (hitBox) {
                    let N = hitNormal;
                    let V = normalize({x:eye.x-hitPoint.x, y:eye.y-hitPoint.y, z:eye.z-hitPoint.z});

                    // material properties
                    let ka = hitBox.ambient;
                    let kd = hitBox.diffuse;
                    let ks = hitBox.specular;
                    let shininess = hitBox.n;

                    // final color accumulators
                    let r=0,g=0,b=0;

                    // compute per-light contribution
                    for (let l=0; l<inputLights.length; l++) {
                        let Lraw = {x:inputLights[l].x-hitPoint.x, 
                                    y:inputLights[l].y-hitPoint.y, 
                                    z:inputLights[l].z-hitPoint.z};
                        let L = normalize(Lraw);
                        let H = normalize({x:L.x+V.x, y:L.y+V.y, z:L.z+V.z});

                        // contributions
                        let diff = Math.max(dot(N,L),0);
                        let spec = Math.pow(Math.max(dot(N,H),0), shininess);

                        // ambient
                        r += ka[0]*inputLights[l].ambient[0];
                        g += ka[1]*inputLights[l].ambient[1];
                        b += ka[2]*inputLights[l].ambient[2];

                        // diffuse
                        r += kd[0]*inputLights[l].diffuse[0]*diff;
                        g += kd[1]*inputLights[l].diffuse[1]*diff;
                        b += kd[2]*inputLights[l].diffuse[2]*diff;

                        // specular
                        r += ks[0]*inputLights[l].specular[0]*spec;
                        g += ks[1]*inputLights[l].specular[1]*spec;
                        b += ks[2]*inputLights[l].specular[2]*spec;
                    }

                    let idx = (py*w + px) * 4;
                    imagedata.data[idx]   = Math.min(255,r*255);
                    imagedata.data[idx+1] = Math.min(255,g*255);
                    imagedata.data[idx+2] = Math.min(255,b*255);
                    imagedata.data[idx+3] = 255;
                }

            }
        }
        context.putImageData(imagedata, 0, 0);
    }

    // ray-box intersection with normal output
    function rayIntersectBox(rayOrigin, rayDir, box) {
        let tmin = -Infinity, tmax = Infinity;
        let hitNormal = null;

        let slabs = [
            {lo: box.lx, hi: box.rx, origin: rayOrigin.x, dir: rayDir.x, axis:"x"},
            {lo: box.by, hi: box.ty, origin: rayOrigin.y, dir: rayDir.y, axis:"y"},
            {lo: box.fz, hi: box.rz, origin: rayOrigin.z, dir: rayDir.z, axis:"z"}
        ];

        for (let s of slabs) {
            let t1 = (s.lo - s.origin)/s.dir;
            let t2 = (s.hi - s.origin)/s.dir;
            if (t1 > t2) [t1,t2] = [t2,t1];
            if (t1 > tmin) {
                tmin = t1;
                hitNormal = {x:0,y:0,z:0};
                hitNormal[s.axis] = (s.dir>0?-1:1);
            }
            if (t2 < tmax) tmax = t2;
            if (tmax < tmin) return null;
        }

        if (tmin < 0) return null;
        let hitPoint = {
            x: rayOrigin.x + tmin*rayDir.x,
            y: rayOrigin.y + tmin*rayDir.y,
            z: rayOrigin.z + tmin*rayDir.z
        };
        return {t:tmin, point:hitPoint, normal:hitNormal};
    }
}

// -------------------- INTEGRATION HOOK --------------------
// Call this from your main `window.onload` or `main()` driver
// Example:
//
// function main() {
//     let canvas = document.getElementById("viewport");
//     let context = canvas.getContext("2d");
//     drawRandPixelsInInputBoxes(context);  // NEW
//     drawRandPixelsInInputTriangles(context);
//     drawRandPixelsInInputEllipsoids(context);
// }
