# FloodSense street backend

Express, MongoDB/Mongoose and Socket.IO, integrated with the existing Next.js app at `/streets`.

See [setup, preview, security, Atlas and Netlify instructions](../../docs/BACKEND-INTEGRATION.md).

- `npm ci` then `npm run preview`: disposable synthetic local backend on port 4003.
- `npm start`: database-backed server using `MONGO_URI` from `.env`.
- `npm run seed`: insert-only samples, requires `DATA_MODE=synthetic`.
- `npm run admin -- registered-email`: explicitly promote a registered reviewer.
- `npm run check` and `npm test`: syntax and disposable MongoDB integration tests.

Reports require authentication and moderation. Unobserved roads are unknown. The
prediction endpoint is an unvalidated heuristic, not a trained AI or safety guarantee.
No database passwords are included in this repository.
