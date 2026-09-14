// ==============================================
// utils/dashboardAuth.js
// 管理者ダッシュボード用の簡易Basic認証ミドルウェア
// 環境変数 DASHBOARD_PASSWORD が未設定の場合はダッシュボード自体を無効化する
// ==============================================

export function createDashboardAuth() {
    const password = process.env.DASHBOARD_PASSWORD;
    const username = process.env.DASHBOARD_USERNAME || 'admin';

    if (!password) {
        console.warn('[WARNING] DASHBOARD_PASSWORD が未設定のため、管理者ダッシュボード(/admin)は無効です。');
    }

    return function dashboardAuth(req, res, next) {
        if (!password) {
            return res.status(503).send(
                'ダッシュボードは現在無効です。環境変数 DASHBOARD_PASSWORD (任意で DASHBOARD_USERNAME) を設定して再起動してください。'
            );
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.set('WWW-Authenticate', 'Basic realm="hinansaba-admin-dashboard"');
            return res.status(401).send('認証が必要です。');
        }

        let user = '';
        let pass = '';
        try {
            const base64Credentials = authHeader.split(' ')[1];
            const decoded = Buffer.from(base64Credentials, 'base64').toString('utf8');
            const separatorIndex = decoded.indexOf(':');
            user = decoded.slice(0, separatorIndex);
            pass = decoded.slice(separatorIndex + 1);
        } catch {
            res.set('WWW-Authenticate', 'Basic realm="hinansaba-admin-dashboard"');
            return res.status(401).send('認証情報の形式が不正です。');
        }

        if (user !== username || pass !== password) {
            res.set('WWW-Authenticate', 'Basic realm="hinansaba-admin-dashboard"');
            return res.status(401).send('ユーザー名またはパスワードが違います。');
        }

        next();
    };
}
