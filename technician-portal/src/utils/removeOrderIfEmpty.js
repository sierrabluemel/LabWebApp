import callApi from "./api/callApi";

// After a batch is removed: deletes the order too when it has no batches left, so it does not linger on the shipping list.
// Resolves to true when the order was deleted.
export default function removeOrderIfEmpty(orderId) {
    return callApi('get-batches-by-order-id', { order_id: orderId })
        .then(batches => batches.length === 0
            ? callApi('delete-order', { order_id: orderId }).then(() => true)
            : false);
}
