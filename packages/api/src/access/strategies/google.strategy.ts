import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    // Provide default values if Google OAuth is not configured
    const clientID = process.env.GOOGLE_AUTH_CLIENT_ID || 'placeholder-client-id';
    const clientSecret = process.env.GOOGLE_AUTH_CLIENT_SECRET || 'placeholder-secret';
    const callbackURL = process.env.GOOGLE_AUTH_CALLBACK_URL || 'http://localhost:3000/api/access/google/redirect';

    super({
      clientID,
      clientSecret,
      callbackURL,
      returnURL: process.env.GOOGLE_AUTH_RETURN_URL || 'http://localhost:5173',
      scope: ['email', 'profile'],
      accessType: 'offline',
      prompt: 'consent',
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    const { name, emails, id, photos } = profile;
    const user = {
      googleId: id,
      email: emails[0].value,
      verifiedEmail: emails[0].verified,
      familyName: name.familyName,
      givenName: name.givenName,
      displayName: profile.displayName,
      picture: photos?.[0]?.value,
      accessToken,
      refreshToken,
      locale: profile._json.locale,
      provider: profile.provider,
    };

    done(null, user);
  }

}
