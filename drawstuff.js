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
        } catch (e) {
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
        } catch (e) {
            console.log(e);
        }
    }
} // end Color class

/* ---------------------------------
   ADDITIONS / FIXES
---------------------------------- */
const NULL_PLACEHOLDER = null;   
function safeLog(msg) { console.log(msg); }

/* utility functions */
function getInputLights() {
    return [
        {"x": -0.5, "y": 1.5, "z": -0.5, "ambient": [1,1,1], "diffuse": [1,1,1], "specular": [1,1,1]}
    ];
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
            imagedata.data[pixelindex]   = color.r;
            imagedata.data[pixelindex+1] = color.g;
            imagedata.data[pixelindex+2] = color.b;
            imagedata.data[pixelindex+3] = color.a;
        } else 
            throw "drawpixel color is not a Color";
    } catch(e) {
        safeLog(e);
    }
}

// draw random pixels
function drawRandPixels(context) {
    var c = new Color(0,0,0,0);
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w,h);
    const PIXEL_DENSITY = 0.01;
    var numPixels = (w*h)*PIXEL_DENSITY; 
    
    for (var x=0; x<numPixels; x++) {
        c.change(Math.random()*255,Math.random()*255,
                 Math.random()*255,255);
        drawPixel(imagedata,
            Math.floor(Math.random()*w),
            Math.floor(Math.random()*h),
            c);
    }
    context.putImageData(imagedata, 0, 0);
}

// fetch JSON helper
function fetchJSON(url, label) {
    try {
        var httpReq = new XMLHttpRequest();
        httpReq.open("GET", url, false);
        httpReq.send(null);
        if (httpReq.status !== 200) {
            safeLog("Unable to open input " + label + " file!");
            return NULL_PLACEHOLDER;
        } else {
            return JSON.parse(httpReq.response);
        }
    } catch(e) {
        safeLog("Error fetching " + label + ": " + e);
        return NULL_PLACEHOLDER;
    }
}

function getInputEllipsoids() {
    return fetchJSON("https://ncsucgclass.github.io/prog1/ellipsoids.json","ellipsoids");
}
function getInputTriangles() {
    return fetchJSON("https://ncsucgclass.github.io/prog1/triangles.json","triangles");
}
function getInputBoxes() {
    return fetchJSON("https://ncsucgclass.github.io/prog1/boxes.json","boxes");
}

/* ---------------------------------
   DRAW FUNCTIONS
---------------------------------- */

// draw random pixels in ellipsoids
function drawRandPixelsInInputEllipsoids(context) {
    var inputEllipsoids = getInputEllipsoids();
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w,h);
    var c = new Color(0,0,0,0);

    if (inputEllipsoids != NULL_PLACEHOLDER) {
        for (var e=0; e<inputEllipsoids.length; e++) {
            var ellipsoid = inputEllipsoids[e];
            var cx = ellipsoid.x * w;
            var cy = ellipsoid.y * h;
            var rx = ellipsoid.a * w;
            var ry = ellipsoid.b * h;
            var numPixels = rx * ry * 0.5;

            for (var p=0; p<numPixels; p++) {
                var px = Math.floor(cx + (Math.random()-0.5)*2*rx);
                var py = Math.floor(cy + (Math.random()-0.5)*2*ry);
                c.change(ellipsoid.diffuse[0]*255,
                         ellipsoid.diffuse[1]*255,
                         ellipsoid.diffuse[2]*255,
                         255);
                drawPixel(imagedata,px,py,c);
            }
        }
        context.putImageData(imagedata,0,0);
    }
}

// draw ellipsoids using arcs
function drawInputEllipsoidsUsingArcs(context) {
    var inputEllipsoids = getInputEllipsoids();
    if (inputEllipsoids != NULL_PLACEHOLDER) {
        for (var e=0; e<inputEllipsoids.length; e++) {
            var ellipsoid = inputEllipsoids[e];
            var cx = ellipsoid.x * context.canvas.width;
            var cy = ellipsoid.y * context.canvas.height;
            var rx = ellipsoid.a * context.canvas.width;
            var ry = ellipsoid.b * context.canvas.height;

            context.beginPath();
            context.ellipse(cx,cy,rx,ry,0,0,2*Math.PI);
            context.fillStyle = "rgb(" + 
                Math.floor(ellipsoid.diffuse[0]*255) + "," +
                Math.floor(ellipsoid.diffuse[1]*255) + "," +
                Math.floor(ellipsoid.diffuse[2]*255) + ")";
            context.fill();
        }
    }
}

// draw random pixels in triangles
function drawRandPixelsInInputTriangles(context) {
    var inputTriangles = getInputTriangles();
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w,h);
    var c = new Color(0,0,0,0);

    if (inputTriangles != NULL_PLACEHOLDER) {
        for (var t=0; t<inputTriangles.length; t++) {
            var triSet = inputTriangles[t];
            var n = triSet.vertices.length;
            for (var tri=0; tri<n; tri+=3) {
                var v0 = triSet.vertices[tri];
                var v1 = triSet.vertices[tri+1];
                var v2 = triSet.vertices[tri+2];
                for (var p=0; p<1000; p++) {
                    var r1 = Math.random();
                    var r2 = Math.random();
                    if (r1+r2>1) { r1=1-r1; r2=1-r2; }
                    var px = (1-r1-r2)*v0[0] + r1*v1[0] + r2*v2[0];
                    var py = (1-r1-r2)*v0[1] + r1*v1[1] + r2*v2[1];
                    c.change(triSet.diffuse[0]*255,
                             triSet.diffuse[1]*255,
                             triSet.diffuse[2]*255,
                             255);
                    drawPixel(imagedata,Math.floor(px*w),Math.floor(py*h),c);
                }
            }
        }
        context.putImageData(imagedata,0,0);
    }
}

// draw triangles using paths
function drawInputTrianglesUsingPaths(context) {
    var inputTriangles = getInputTriangles();
    if (inputTriangles != NULL_PLACEHOLDER) {
        for (var t=0; t<inputTriangles.length; t++) {
            var triSet = inputTriangles[t];
            var n = triSet.vertices.length;
            for (var tri=0; tri<n; tri+=3) {
                var v0 = triSet.vertices[tri];
                var v1 = triSet.vertices[tri+1];
                var v2 = triSet.vertices[tri+2];
                context.beginPath();
                context.moveTo(v0[0]*context.canvas.width, v0[1]*context.canvas.height);
                context.lineTo(v1[0]*context.canvas.width, v1[1]*context.canvas.height);
                context.lineTo(v2[0]*context.canvas.width, v2[1]*context.canvas.height);
                context.closePath();
                context.fillStyle = "rgb(" +
                    Math.floor(triSet.diffuse[0]*255) + "," +
                    Math.floor(triSet.diffuse[1]*255) + "," +
                    Math.floor(triSet.diffuse[2]*255) + ")";
                context.fill();
            }
        }
    }
}

// draw random pixels in boxes
function drawRandPixelsInInputBoxes(context) {
    var inputBoxes = getInputBoxes();
    var w = context.canvas.width;
    var h = context.canvas.height;
    var imagedata = context.createImageData(w,h);
    var c = new Color(0,0,0,0);

    if (inputBoxes != NULL_PLACEHOLDER) {
        for (var b=0; b<inputBoxes.length; b++) {
            var box = inputBoxes[b];
            var minx = box.lx*w;
            var maxx = box.rx*w;
            var miny = box.by*h;
            var maxy = box.ty*h;

            for (var p=0; p<5000; p++) {
                var px = Math.floor(minx + Math.random()*(maxx-minx));
                var py = Math.floor(miny + Math.random()*(maxy-miny));
                c.change(box.diffuse[0]*255,
                         box.diffuse[1]*255,
                         box.diffuse[2]*255,
                         255);
                drawPixel(imagedata,px,py,c);
            }
        }
        context.putImageData(imagedata,0,0);
    }
}

// draw boxes using paths
function drawInputBoxesUsingPaths(context) {
    var inputBoxes = getInputBoxes();
    if (inputBoxes != NULL_PLACEHOLDER) {
        for (var b=0; b<inputBoxes.length; b++) {
            var box = inputBoxes[b];
            var minx = box.lx*context.canvas.width;
            var maxx = box.rx*context.canvas.width;
            var miny = box.by*context.canvas.height;
            var maxy = box.ty*context.canvas.height;

            context.beginPath();
            context.rect(minx,miny,maxx-minx,maxy-miny);
            context.fillStyle = "rgb(" +
                Math.floor(box.diffuse[0]*255) + "," +
                Math.floor(box.diffuse[1]*255) + "," +
                Math.floor(box.diffuse[2]*255) + ")";
            context.fill();
        }
    }
}
