// -----------------------------
// Raycast Rasterizer (multi-shape)
// Usage: <canvas id="viewport" width="800" height="600"></canvas>
// Call main() after DOM loads.
// Press SPACE to toggle between boxes-only and full scene
// -----------------------------

/* -----------------------
   Color class + pixel helper
   ----------------------- */
class Color {
    constructor(r=0, g=0, b=0, a=255) {
        if (![r,g,b,a].every(c => typeof c === "number")) throw "color component not a number";
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
        this.a = Math.max(0, Math.min(255, a));
    }
}

function drawPixel(imagedata, x, y, color) {
    if (x<0 || y<0 || x>=imagedata.width || y>=imagedata.height) return;
    if (!(color instanceof Color)) return;
    const idx = (y*imagedata.width + x) * 4;
    imagedata.data[idx] = color.r;
    imagedata.data[idx+1] = color.g;
    imagedata.data[idx+2] = color.b;
    imagedata.data[idx+3] = color.a;
}

/* -----------------------
   Vector helpers
   ----------------------- */
function v(x,y,z){ return {x,y,z}; }
function vAdd(a,b){ return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
function vSub(a,b){ return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
function vScale(a,s){ return {x:a.x*s, y:a.y*s, z:a.z*s}; }
function vDot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
function vLen(a){ return Math.sqrt(vDot(a,a)); }
function vNorm(a){ let L=vLen(a)||1; return {x:a.x/L, y:a.y/L, z:a.z/L}; }
function vCross(a,b){ return {x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x}; }

/* -----------------------
   Defaults
   ----------------------- */
const DEFAULT_LIGHTS = [
  {x:-0.5,y:1.5,z:-0.5,ambient:[0.1,0.1,0.1],diffuse:[1,1,1],specular:[1,1,1]},
  {x: 1.0,y:1.5,z:-0.2,ambient:[0,0,0],diffuse:[0.6,0.6,0.6],specular:[0.6,0.6,0.6]}
];

const DEFAULT_BOXES = [
  {lx:0.15,rx:0.35,by:0.25,ty:0.55,fz:0,rz:0.5,
   ambient:[0.05,0.05,0.05],diffuse:[0.8,0.2,0.2],specular:[0.9,0.9,0.9],n:40},
  {lx:0.6,rx:0.85,by:0.3,ty:0.65,fz:0,rz:0.6,
   ambient:[0.02,0.02,0.02],diffuse:[0.2,0.6,0.8],specular:[0.9,0.9,0.9],n:20}
];

const DEFAULT_ELLIPSOIDS = [
  {center:{x:0.5,y:0.6,z:0.3}, radii:{x:0.12,y:0.12,z:0.12},
   ambient:[0.02,0.02,0.02], diffuse:[0.3,0.8,0.3], specular:[0.9,0.9,0.9], n:30}
];

const DEFAULT_TRIANGLES = [
  { vertices:[[0.1,0.9,0.1],[0.3,0.7,0.2],[0.2,0.6,0.15]],
    triangles:[[0,1,2]],
    material:{ambient:[0.02,0.02,0.02],diffuse:[0.9,0.8,0.2],specular:[0.8,0.8,0.8],n:10} }
];

/* -----------------------
   Shape classes
   ----------------------- */
// Ellipsoid
class Ellipsoid {
  constructor(center,radii,material){this.center=center;this.radii=radii;this.material=material;}
  rayIntersect(O,D){
    const invR={x:1/this.radii.x,y:1/this.radii.y,z:1/this.radii.z};
    const Oc=vSub(O,this.center);
    const Oe={x:Oc.x*invR.x,y:Oc.y*invR.y,z:Oc.z*invR.z};
    const De={x:D.x*invR.x,y:D.y*invR.y,z:D.z*invR.z};
    const a=vDot(De,De), b=2*vDot(De,Oe), c=vDot(Oe,Oe)-1;
    const disc=b*b-4*a*c; if(disc<0) return null;
    const sqrtD=Math.sqrt(disc);
    const t0=(-b-sqrtD)/(2*a), t1=(-b+sqrtD)/(2*a);
    const t=(t0>1e-6)?t0:((t1>1e-6)?t1:null); if(t===null) return null;
    const p=vAdd(O,vScale(D,t));
    const nRaw={x:(p.x-this.center.x)/(this.radii.x**2),
                y:(p.y-this.center.y)/(this.radii.y**2),
                z:(p.z-this.center.z)/(this.radii.z**2)};
    return {t,point:p,normal:vNorm(nRaw),material:this.material};
  }
}

// Axis-aligned box
class AABB {
  constructor(lx,rx,by,ty,fz,rz,material){
    Object.assign(this,{lx,rx,by,ty,fz,rz,material});
  }
  rayIntersect(O,D){
    let tmin=-Infinity,tmax=Infinity,normal={x:0,y:0,z:0};
    function check(lo,hi,o,d,axis){
      if(Math.abs(d)<1e-8){if(o<lo||o>hi)return null;return{t1:-Infinity,t2:Infinity,n1:null,n2:null};}
      let t1=(lo-o)/d, t2=(hi-o)/d; let n1={[axis]:(d>0)?-1:1}, n2={[axis]:(d>0)?1:-1};
      if(t1>t2){[t1,t2]=[t2,t1];[n1,n2]=[n2,n1];}
      return {t1,t2,n1,n2};
    }
    const axes=[
      check(this.lx,this.rx,O.x,D.x,"x"),
      check(this.by,this.ty,O.y,D.y,"y"),
      check(this.fz,this.rz,O.z,D.z,"z")];
    if(axes.some(a=>a===null)) return null;
    let tn=axes[0].t1, nn=axes[0].n1, tf=axes[0].t2;
    for(let a of axes.slice(1)){
      if(a.t1>tn){tn=a.t1;nn=a.n1;}
      if(a.t2<tf) tf=a.t2;
      if(tf<tn) return null;
    }
    const t=(tn>1e-6)?tn:tf; if(t<1e-6) return null;
    return {t,point:vAdd(O,vScale(D,t)),normal:nn,material:this.material};
  }
}

// Triangle
class Triangle {
  constructor(v0,v1,v2,material){this.v0=v0;this.v1=v1;this.v2=v2;this.material=material;
    this.edge1=vSub(v1,v0);this.edge2=vSub(v2,v0);this.normal=vNorm(vCross(this.edge1,this.edge2));}
  rayIntersect(O,D){
    const EPS=1e-8,h=vCross(D,this.edge2),a=vDot(this.edge1,h);
    if(Math.abs(a)<EPS)return null;const f=1/a,s=vSub(O,this.v0),u=f*vDot(s,h);
    if(u<0||u>1)return null;const q=vCross(s,this.edge1),v=f*vDot(D,q);
    if(v<0||u+v>1)return null;const t=f*vDot(this.edge2,q);
    if(t>EPS){return{t,point:vAdd(O,vScale(D,t)),normal:this.normal,material:this.material};}
    return null;
  }
}

/* -----------------------
   Scene + Renderer
   ----------------------- */
class Scene {
  constructor(){this.objects=[];this.lights=DEFAULT_LIGHTS;this.background=new Color(0,0,0);this.eye={x:0.5,y:0.5,z:-0.5};this.ambientGlobal=0.05;}
  addObject(o){this.objects.push(o);}
  traceRay(O,D){let best=null;for(let o of this.objects){const hit=o.rayIntersect(O,D);if(hit&&(best==null||hit.t<best.t))best=hit;}return best;}
  shade(hit,view){const m=hit.material;let r=(m.ambient[0]||0)*this.ambientGlobal,g=(m.ambient[1]||0)*this.ambientGlobal,b=(m.ambient[2]||0)*this.ambientGlobal;
    for(let L of this.lights){const ld=vNorm(vSub(v(L.x,L.y,L.z),hit.point));
      const diff=Math.max(0,vDot(hit.normal,ld));
      r+=m.diffuse[0]*L.diffuse[0]*diff; g+=m.diffuse[1]*L.diffuse[1]*diff; b+=m.diffuse[2]*L.diffuse[2]*diff;
      const h=vNorm(vAdd(ld,view)); const spec=Math.pow(Math.max(0,vDot(hit.normal,h)),m.n);
      r+=m.specular[0]*L.specular[0]*spec; g+=m.specular[1]*L.specular[1]*spec; b+=m.specular[2]*L.specular[2]*spec;}
    return new Color(Math.min(255,r*255),Math.min(255,g*255),Math.min(255,b*255));}
  render(ctx){const w=ctx.canvas.width,h=ctx.canvas.height,img=ctx.createImageData(w,h);
    for(let y=0;y<h;y++){for(let x=0;x<w;x++){const ndcX=(x+0.5)/w,ndcY=1-(y+0.5)/h;
      const dir=vNorm({x:ndcX-this.eye.x,y:ndcY-this.eye.y,z:0-this.eye.z});
      const hit=this.traceRay(this.eye,dir);if(hit){const c=this.shade(hit,vNorm(vScale(dir,-1)));
        const idx=(y*w+x)*4; img.data[idx]=c.r; img.data[idx+1]=c.g; img.data[idx+2]=c.b; img.data[idx+3]=c.a;}}}
    ctx.putImageData(img,0,0);}
}

/* -----------------------
   Scene builders
   ----------------------- */
function buildBoxesOnly(){const s=new Scene();for(let b of DEFAULT_BOXES){s.addObject(new AABB(b.lx,b.rx,b.by,b.ty,b.fz,b.rz,b));}return s;}
function buildFull(){const s=new Scene();
  for(let b of DEFAULT_BOXES) s.addObject(new AABB(b.lx,b.rx,b.by,b.ty,b.fz,b.rz,b));
  for(let e of DEFAULT_ELLIPSOIDS) s.addObject(new Ellipsoid(e.center,e.radii,e));
  for(let t of DEFAULT_TRIANGLES){const [a,b,c]=t.triangles[0].map(i=>({x:t.vertices[i][0],y:t.vertices[i][1],z:t.vertices[i][2]}));
    s.addObject(new Triangle(a,b,c,t.material));}
  return s;}

/* -----------------------
   Main
   ----------------------- */
function main(){
  const canvas=document.getElementById("viewport");const ctx=canvas.getContext("2d");
  let mode=0; let scenes=[buildBoxesOnly(),buildFull()];
  function render(){scenes[mode].render(ctx);} render();
  window.addEventListener("keydown",e=>{if(e.code==="Space"){mode=(mode+1)%2;render();}});
}
