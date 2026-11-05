import config from './config'

const headers = {
    'APIKeyID': config.IMONNIT_API_KEY_ID,
    'APISecretKey': config.IMONNIT_API_SECRET_KEY_ID,
};

let running = false;
let queue: any[] = [];
const API_MAX_CALLS = 1;

// Async for non blocking
async function recursiveQueue() {
    // If queue is empty - exit
    if (queue.length == 0) {
        running = false;
        return;
    }

    // Get the data for the current queue item
    let { url, res, rej, attempts, maxRetry } = queue.shift();

    // Run the request
    fetch(url, { headers })
        .then((response) => {
            // Get response
            if (response.status !== 200)
                return Promise.reject(response);
            else
                return response.json()
        })
        .then((json) => {
            // Resolve the promise
            res(json);
        })
        .catch(() => {
            // Increment attempts
            attempts++;
            // If current attempt is over max retries, reject promise
            if (attempts > maxRetry)
                rej(`Max retries exceeded for url: ${url}`);
            // Max retries not exceeded - push item to back of queue for retry
            else
                queue.push({ url, res, rej, attempts, maxRetry });
        })
        .finally(() => setTimeout(recursiveQueue, 1000/API_MAX_CALLS));
}

function monnitFetch(url: string, maxRetry: number = 10) {
    // Create the promise
    let queued = new Promise<any>((res, rej) => {
        // Push it to the queue
        queue.push({ url, res, rej, attempts: 0, maxRetry })
    });

    // If queue is not being processed
    if (!running) {
        // Begin running the queue
        running = true;
        recursiveQueue();
    }

    // Return the promise
    return queued;
}

export default monnitFetch