/**
 * readableStream
 *  .pipeThrough(
 *    new FilterStream((value)=>value === value)
 *  ).pipeTo(writeableStream)
 * 
 * let [spyStream, newReadableStream] = readableStream.tee()
 * spyStream
 *  .pipeThrough(
 *    new FilterStream((value)=>value === value)
 *  ).pipeTo(writeableStream);
 * 
 * newReadableStream.locked === false 
 * 
 * @param {(chunk: any)=>boolean} filter 
 */
  
/**
 * takes a readable and a array of writable Streams
 * pipes .tee() copys of the readable into the writeables
 * and returns a copy of the original readable.
 * @param {ReadableStream} readableStream 
 * @param {WritableStream[]} writableStreams 
 * @returns {ReadableStream}
 */
const pipeToStreams = (readableStream, writableStreams) => {
    let nextStream = readableStream;
    writableStreams.forEach( (writableStream) => {
        const [current, next] = nextStream.tee();
        nextStream = next;
        current.pipeTo(writableStream);
    } );
    return nextStream;
}
  
/**
 * ReadableStream with .push() method
 */
class ReadableStreamWithPush extends ReadableStream {
    constructor() {
        /** @type {ReadableStreamController<any>} */
        let defferedController; //let localScope = { /** @type {ReadableStreamController<any>.enqueue} */ push(/** @type {any} */ chunk) {} };
        const start = (/** @type {ReadableStreamController<any>} */ controller) => defferedController = controller; //localScope.push = (/** @type {any} */ chunk) => controller.enqueue(chunk);
        super({ start }); 
        this.push = (/** @type {any} */ chunk) => defferedController.enqueue(chunk);
        this.enqueue = (/** @type {any} */ chunk) => defferedController.enqueue(chunk);
        // readonly desiredSize: number | null;
        // close
        //error(reason?: any): void;
        // terminate(): void;
    }
};

const FilterTransformStream = class FilterStream extends TransformStream {
    constructor(/** @type {(chunk: any)=>boolean} */ filter) {
        const transform = (/** @type {any} */ chunk, /** @type {TransformStreamDefaultController} */ controller) => {
         if (filter(chunk)) { controller.enqueue(chunk) };
        };
        super({ transform });
    }
};
/**
 * offers a new readable and writeable stream via a new ReadableStreamWithPush
 * takes a transform function as optional arrgument 
 * that writes to the push stream.
 */
const newPipeThroughStream = (/** @type {(chunk: any, controller: ReadableStreamWithPush) => void} */ transform = (chunk, controller) => controller.enqueue(chunk)) => {
    const readable = new ReadableStreamWithPush();    
    const write = (/** @type {any} */ chunk) => transform(chunk, readable);
    const writable = new WritableStream({ write })
    return { writable, readable }
}

class TransformStreamFromFunction {
    constructor(/** @type {(chunk: any, controller: ReadableStreamWithPush) => void} */ transform = (chunk, controller) => controller.enqueue(chunk)) {
        const { readable, writable } = newPipeThroughStream(transform);
        this.readable = readable;
        this.writable = writable;
    }
    pipeThrough(/** @type {ReadableStream} */ readableStream) {
        readableStream.pipeTo(this.writable);
        return this.readable;
    }
}

const pipeThrough = (
    /** @type {ReadableStream} */ readableStream,
    /** @type {(chunk: any, controller: ReadableStreamWithPush) => void} */ transformMethod
) => ( new TransformStreamFromFunction(transformMethod) ).pipeThrough(readableStream);

// Example FilterStream via pipeThrough
const filterStreamPipeThrough = (
    /** @type {ReadableStream} */ readableStream, 
    /** @type {(chunk: any) => boolean} */ filter = (/** @type {any} */ chunk) => chunk,
) => pipeThrough( readableStream, (chunk, controller) => { if (filter(chunk)) { controller.enqueue(chunk) }; } );

/**
 * combines streams via a new ReadableStreamWithPush
 * all other streams get a new writableStream
 * that writes to the push stream.
 * @param {ReadableStream[]} streams 
 */
const flattenStreams = (streams) => {
    const mergedStream = new ReadableStreamWithPush();
    streams.forEach( (stream) => stream.pipeTo(new WritableStream({ 
        write(chunk) { mergedStream.push(chunk) }
    })) );
    return mergedStream;
}

async function* asAsyncIterator(/** @type {ReadableStream} */ stream) {
    const reader = stream.getReader();
    try {
        while (true) {
            const {done, value} = await reader.read();
            if (done) { return; };
            yield value;
        }
    } finally {
        reader.releaseLock();
    }
};
  
/**
 * 
 * @param {any} eventEmitter 
 * @param {string} callbackName 
 * @param {string} [returnPropertyName] -
 * @returns 
 */
const readableFromEvent = (eventEmitter, callbackName, returnPropertyName) => 
    new ReadableStream({ start(controller) {
      eventEmitter[callbackName] = (/** @type {any} */ event) => controller.enqueue(returnPropertyName ? eventEmitter[returnPropertyName] : event);
    } });
  
export { readableFromEvent, asAsyncIterator, flattenStreams, FilterTransformStream, filterStreamPipeThrough, pipeToStreams, ReadableStreamWithPush}