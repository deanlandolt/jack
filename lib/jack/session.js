/**
 * Session variables live throughout a user's session.
 *
 * HTTP is a stateless protocol for a *good* reason. Try to avoid using 
 * session variables. 
 */
var Session = exports.Session = function(request) {
    if (!request.env.jack.session) {
        try {
            request.env.jack.session = request.env.jack.session.loadSession(env);
        } catch (e) {
            request.env.jack.session = {};
        }
    }
    return session.env.jack.session;
}
