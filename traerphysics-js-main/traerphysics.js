// traerphysics.js

// =======================
// Basic Vector
// =======================
export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    div(s) {
        this.x /= s;
        this.y /= s;
        return this;
    }

    copy() {
        return new Vec2(this.x, this.y);
    }

    mag() {
        return Math.hypot(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    static sub(a, b) {
        return new Vec2(a.x - b.x, a.y - b.y);
    }
}

// =======================
// Particle
// =======================
export class Particle {
    constructor(x, y, m = 1) {
        this.position = new Vec2(x, y);
        this.prev = this.position.copy();
        this.acc = new Vec2();
        this.mass = m;
        this.invMass = m > 0 ? 1 / m : 0;
        this.pinned = false;
    }

    applyForce(f) {
        this.acc.add(f.copy().mult(this.invMass));
    }

    integrate(dt) {
        if (this.pinned) {
            this.acc.set(0, 0);
            return;
        }

        const vel = Vec2.sub(this.position, this.prev);
        const next = this.position.copy().add(vel).add(this.acc.copy().mult(dt * dt));
        this.prev = this.position.copy();
        this.position = next;
        this.acc.set(0, 0);
    }
}

// =======================
// Spring
// =======================
export class Spring {
    constructor(a, b, k = 0.1, len = null) {
        this.a = a;
        this.b = b;
        this.k = k;
        this.length = len??Vec2.sub(a.position, b.position).mag();
    }

    apply() {
        const delta = Vec2.sub(this.b.position, this.a.position);
        const dist = delta.mag() || 1;
        const diff = (dist - this.length) / dist;
        const f = delta.copy().mult(this.k * diff * 0.5);
        if (!this.a.pinned) this.a.position.add(f);
        if (!this.b.pinned) this.b.position.sub(f);
    }
}

// =======================
// Attraction (inverse-square)
// =======================
export class Attraction {
    constructor(a, b, k = 100, minDist = 20, maxDist = 500) {
        this.a = a;
        this.b = b;
        this.k = k;
        this.minDist = minDist;
        this.maxDist = maxDist;
    }

    apply() {
        const delta = Vec2.sub(this.b.position, this.a.position);
        const distSq = delta.x * delta.x + delta.y * delta.y;
        if (distSq < 1e-6) return;
        const dist = Math.sqrt(distSq);
        if (dist < this.minDist || dist > this.maxDist) return;
        delta.div(dist);
        const strength = this.k / distSq;
        const f = delta.copy().mult(strength);
        this.a.applyForce(f);
        this.b.applyForce(new Vec2(-f.x,-f.y));
    }
}

// =======================
// Drag Force
// =======================
export class Drag {
    constructor(c = 0.1) {
        this.c = c;
    }

    apply(p) {
        const vel = Vec2.sub(p.position, p.prev);
        const f = vel.copy().mult(-this.c);
        p.applyForce(f);
    }
}

// =======================
// Distance Constraint
// =======================
export class DistanceConstraint {
    constructor(a, b, length = null) {
        this.a = a;
        this.b = b;
        this.length = length??Vec2.sub(a.position,b.position).mag();
    }

    apply(){
        const delta = Vec2.sub(this.b.position,this.a.position);
        const dist = delta.mag() || 1;
        const diff = (dist-this.length) / dist;
        if (!this.a.pinned) this.a.position.add(new Vec2(delta.x*diff*0.5, delta.y*diff*0.5));
        if (!this.b.pinned) this.b.position.sub(new Vec2(delta.x*diff*0.5, delta.y*diff*0.5));
    }
}

// =======================
// Angle Constraint
// =======================
export class AngleConstraint {
    constructor(a,b,c,targetAngle,stiffness=0.5) {
        this.a=a; this.b=b; this.c=c;
        this.target=targetAngle; this.stiffness=stiffness;
    }

    apply(){
        const ab=Vec2.sub(this.a.position,this.b.position);
        const cb=Vec2.sub(this.c.position,this.b.position);
        const angle=Math.atan2(cb.y,cb.x)-Math.atan2(ab.y,ab.x);
        let diff=angle-this.target;
        while(diff>Math.PI) diff-=2*Math.PI;
        while(diff<-Math.PI) diff+=2*Math.PI;
        const corr=diff*this.stiffness;
        this.a.position.x+=Math.cos(corr);
        this.a.position.y+=Math.sin(corr);
        this.c.position.x-=Math.cos(corr);
        this.c.position.y-=Math.sin(corr);
    }
}

// =======================
// Physics Engine
// =======================
export class Physics {
    constructor() {
        this.particles=[];
        this.springs=[];
        this.attractions=[];
        this.constraints=[];
        this.drag=null;
        this.gravity=new Vec2(0,400);
        this.bounds=null;
    }

    makeParticle(x,y,m=1){
        const p=new Particle(x,y,m);
        this.particles.push(p);
        return p;
    }

    makeSpring(a,b,k=0.1,len=null){
        const s=new Spring(a,b,k,len);
        this.springs.push(s);
        return s;
    }

    makeAttraction(a,b,k=100,min=20,max=500){
        const f=new Attraction(a,b,k,min,max);
        this.attractions.push(f);
        return f;
    }

    makeDistanceConstraint(a,b,len=null){
        const c=new DistanceConstraint(a,b,len);
        this.constraints.push(c);
        return c;
    }

    makeAngleConstraint(a,b,c,target,stiffness=0.5){
        const ac=new AngleConstraint(a,b,c,target,stiffness);
        this.constraints.push(ac);
        return ac;
    }

    setDrag(c){
        this.drag=new Drag(c);
    }

    step(dt){
        // global forces
        for(const p of this.particles){
            if(!p.pinned){
                p.applyForce(new Vec2(this.gravity.x*p.mass,this.gravity.y*p.mass));
                if(this.drag) this.drag.apply(p);
            }
        }
        // pairwise forces
        for(const s of this.springs) s.apply();
        for(const a of this.attractions) a.apply();
        // constraints
        for(const c of this.constraints) c.apply();
        // integrate
        for(const p of this.particles) p.integrate(dt);
        // boundaries
        if(this.bounds) this.enforceBounds(this.bounds);
    }

    enforceBounds(rect){
        const {x,y,w,h}=rect;
        for(const p of this.particles){
            if(p.position.x<x) p.position.x=x;
            if(p.position.x>x+w) p.position.x=x+w;
            if(p.position.y<y) p.position.y=y;
            if(p.position.y>y+h) p.position.y=y+h;
        }
    }
}