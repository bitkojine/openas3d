/**
 * A generic Circular Buffer (Ring Buffer) implementation.
 * Keeps a fixed number of recent items, overwriting the oldest when full.
 */
export class CircularBuffer<T> {
    private buffer: (T | undefined)[];
    private capacity: number;
    private head: number = 0;
    private size: number = 0;

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }

    /**
     * Add an item to the buffer.
     * If the buffer is full, the oldest item is overwritten.
     */
    public push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this.size < this.capacity) {
            this.size++;
        }
    }

    /**
     * Get all items in the buffer, ordered from oldest to newest.
     */
    public getAll(): T[] {
        if (this.size === 0) {
            return [];
        }

        const result: T[] = [];
        // If not full, head points to next empty slot.
        // Elements are at 0 to size-1.
        if (this.size < this.capacity) {
            for (let i = 0; i < this.size; i++) {
                result.push(this.buffer[i] as T);
            }
        } else {
            // Full. head points to the oldest element (which will be overwritten next).
            // We want to start reading from head to end, then 0 to head-1.
            let idx = this.head;
            for (let i = 0; i < this.capacity; i++) {
                result.push(this.buffer[idx] as T);
                idx = (idx + 1) % this.capacity;
            }
        }
        return result;
    }

    public clear(): void {
        this.head = 0;
        this.size = 0;
        this.buffer = new Array(this.capacity);
    }

    public get length(): number {
        return this.size;
    }
}
