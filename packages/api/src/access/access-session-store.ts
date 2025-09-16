// auth/drizzle-session-store.ts
import { Session } from 'express-session';
import { DatabaseService } from 'src/database/database.service';
import * as session from 'express-session';
import { SessionData } from 'express-session';
import { eq } from 'drizzle-orm';

export class AccessSessionStore extends session.Store {

    private db;
    private users;
    private sessions;

    constructor(private databaseService: DatabaseService) {
        super();
        this.db = this.databaseService.db;
        const { users, sessions } = this.databaseService.schema;
        this.users = users;
        this.sessions = sessions;
    }

    touch(sid: string, session: SessionData, callback: (err?: any) => void) {
        this.db
            .update(this.sessions)
            .set({
                expiresAt: session.cookie.expires,
                token: JSON.stringify(session)
            })
            .where(eq(this.sessions.token, sid))
            .then(() => {
                callback();
            })
            .catch((err) => {
                console.error('Error in touch:', err);
                callback(err);
            });
    }

    get(sid: string, callback: (err: any, session?: Session | null) => void) {
        console.log('Session GET called with sid:', sid, 'type:', typeof sid);
        this.db.select().from(this.sessions).where(eq(this.sessions.token, sid))
            .then(result => {
                console.log('Session GET result:', result.length, 'sessions found');
                if (result.length > 0) {
                    console.log('Session found:', {
                        token: result[0].token.substring(0, 20) + '...',
                        userId: result[0].userId,
                        expiresAt: result[0].expiresAt
                    });
                }
                if (!result.length || (result[0].expiresAt && result[0].expiresAt < new Date())) {
                    return callback(null, null);
                }
                // Create a proper session object with touch method
                const session = {
                    cookie: { expires: result[0].expiresAt },
                    touch: function (cb) { if (cb) cb(); }
                };
                callback(null, session);
            })
            .catch(err => {
                console.error('Session GET error:', err);
                callback(err);
            });
    }

    async set(sid: string, session: Session & { cookie: { expires: Date } }, callback: (err?: any) => void) {
        console.log('Session SET called with sid:', sid, 'type:', typeof sid);
        try {
            await this.db
                .insert(this.sessions)
                .values({
                    token: sid, // Use session ID as token
                    userId: 1, // Default user for session store
                    provider: 'session',
                    externalId: sid,
                    createdAt: new Date(),
                    expiresAt: session.cookie.expires,
                })
                .onConflictDoUpdate({
                    target: this.sessions.token,
                    set: {
                        expiresAt: session.cookie.expires,
                    },
                });
            callback();
        } catch (err) {
            console.error('Session store error:', err.message, 'SID:', sid);
            console.error('Full error:', err);
            callback(err);
        }
    }

    async destroy(sid: string, callback: (err?: any) => void) {
        this.db
            .delete(this.sessions)
            .where(eq(this.sessions.token, sid))
            .then(() => callback())
            .catch((err) => callback(err));
    }

}
