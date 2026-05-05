import handler from '../../lib/admin/routes/reports.js';
import { withCorsContext } from '../../lib/http.js';
export default withCorsContext(handler);
