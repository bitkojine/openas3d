
// Mock THREE.js for Node environment tests

export class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    copy(v: Vector3) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    setY(y: number) {
        this.y = y;
        return this;
    }

    add(v: Vector3) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v: Vector3) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    multiplyScalar(s: number) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    normalize() {
        return this;
    }

    subVectors(a: Vector3, b: Vector3) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
    }

    addVectors(a: Vector3, b: Vector3) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this;
    }

    length() { return 1; }
}

export class Object3D {
    public position: Vector3 = new Vector3();
    public rotation: any = { x: 0, y: 0, z: 0 };
    public quaternion: any = {
        setFromUnitVectors: () => { },
        copy: () => { },
        set: () => { }
    };
    public scale: Vector3 = new Vector3(1, 1, 1);
    public children: Object3D[] = [];
    public userData: any = {};
    public name: string = '';
    public visible: boolean = true;

    add(obj: Object3D) {
        this.children.push(obj);
    }

    remove(obj: Object3D) {
        const index = this.children.indexOf(obj);
        if (index > -1) {
            this.children.splice(index, 1);
        }
    }

    lookAt(v: Vector3) { }

    traverse(callback: (object: Object3D) => any) {
        callback(this);
        for (const child of this.children) {
            child.traverse(callback);
        }
    }
}

export class Mesh extends Object3D {
    constructor(public geometry?: any, public material?: any) {
        super();
    }
}

export class Group extends Object3D { }

export class Scene extends Object3D { }

export class BufferGeometry {
    public boundingBox: any = { max: { y: 1 }, min: { y: 0 } };
    public attributes: any = {};
    setFromPoints() { return this; }
    computeBoundingBox() { return this.boundingBox; }
    setAttribute(name: string, attribute: any) { this.attributes[name] = attribute; }
    dispose() { }
}

export class Box3 {
    public min = new Vector3();
    public max = new Vector3();
    constructor() { }
    setFromObject(obj: any) { return this; }
    getSize(target: Vector3) {
        target.set(1, 1, 1);
        return target;
    }
}

export class BoxGeometry extends BufferGeometry {
    constructor(width: number = 1, height: number = 1, depth: number = 1) {
        super();
        this.boundingBox = {
            min: { x: -width / 2, y: -height / 2, z: -depth / 2 },
            max: { x: width / 2, y: height / 2, z: depth / 2 }
        };
    }
}
export class ConeGeometry extends BufferGeometry { }
export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number) { super(); }
}

export class Material {
    dispose() { }
}

export class MeshLambertMaterial extends Material {
    public emissive = { setHex: () => { } };
    public map: any = undefined;
    constructor(parameters?: any) {
        super();
        if (parameters && parameters.map) {
            this.map = parameters.map;
        }
    }
}
export class MeshBasicMaterial extends Material {
}
export class LineBasicMaterial extends Material {
}
export class LineDashedMaterial extends Material {
}
export class SpriteMaterial extends Material {
}

export class Texture {
    public offset = new Vector3();
    public repeat = new Vector3();
    public wrapS = 1000;
    public wrapT = 1000;
    public anisotropy = 0;
    public minFilter = 0;
    public magFilter = 0;
    public needsUpdate = false;

    clone() {
        const t = new Texture();
        t.offset.copy(this.offset);
        t.repeat.copy(this.repeat);
        return t;
    }
    dispose() { }
}

export class CanvasTexture extends Texture {
    constructor(canvas: any) { super(); }
    clone() {
        // Return a Texture instance that mimics CanvasTexture for testing
        const t = new CanvasTexture(null);
        t.offset.copy(this.offset);
        t.repeat.copy(this.repeat);
        return t;
    }
}

export class Sprite extends Object3D {
    constructor(material?: any) {
        super();
    }
}

export class LinearMipmapLinearFilter { }
export class LinearFilter { }
export class QuadraticBezierCurve3 {
    constructor(v0: any, v1: any, v2: any) { }
    getPoints() { return []; }
    getTangent() { return new Vector3(); }
}
export class CubicBezierCurve3 {
    constructor(v0: any, v1: any, v2: any, v3: any) { }
    getPoints() { return []; }
    getTangent() { return new Vector3(); }
}
export class Line extends Object3D {
    constructor(geo?: any, mat?: any) { super(); }
    computeLineDistances() { }
}


export const DoubleSide = 2;
export const RepeatWrapping = 1000;
export const AdditiveBlending = 2;
export const NormalBlending = 1;

export class Color {
    public r: number = 0;
    public g: number = 0;
    public b: number = 0;
    constructor(r?: any, g?: any, b?: any) { }
    set() { }
    clone() { return new Color(this.r, this.g, this.b); }
    offsetHSL() { return this; }
}

export class Float32BufferAttribute {
    public count: number;
    constructor(array: any, itemSize: any) {
        this.count = array.length / itemSize;
    }
}

export class TubeGeometry extends BufferGeometry {
    constructor(path: any, tubularSegments: any, radius: any, radialSegments: any, closed: any) {
        super();
        // Mock default position attribute for count check
        this.attributes.position = { count: (tubularSegments + 1) * (radialSegments + 1) };
    }
}
