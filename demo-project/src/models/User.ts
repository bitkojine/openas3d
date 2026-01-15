export interface UserData {
    id?: string;
    email: string;
    name: string;
    createdAt?: Date;
    updatedAt?: Date;
    isActive?: boolean;
}

export class User {
    public readonly id: string;
    public email: string;
    public name: string;
    public createdAt: Date;
    public updatedAt: Date;
    public isActive: boolean;

    constructor(data: UserData) {
        this.id = data.id || this.generateId();
        this.email = data.email;
        this.name = data.name;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.isActive = data.isActive !== undefined ? data.isActive : true;
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    toJSON(): UserData {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isActive: this.isActive
        };
    }

    updateEmail(newEmail: string): void {
        this.email = newEmail;
        this.updatedAt = new Date();
    }

    updateName(newName: string): void {
        this.name = newName;
        this.updatedAt = new Date();
    }

    activate(): void {
        this.isActive = true;
        this.updatedAt = new Date();
    }

    deactivate(): void {
        this.isActive = false;
        this.updatedAt = new Date();
    }
}