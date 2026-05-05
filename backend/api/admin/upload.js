import handler from '../../lib/admin/routes/upload.js';
import { withCorsContext } from '../../lib/http.js';
export default withCorsContext(handler);
