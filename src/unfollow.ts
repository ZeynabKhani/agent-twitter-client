import { TwitterAuth } from './auth';
import { TwitterUser } from './messages';

/**
 * Unfollows a Twitter user by their username
 * @param username The username of the account to unfollow
 * @param auth The Twitter authentication instance
 * @returns The unfollowed user's information
 */
export async function unfollowUser(
  username: string,
  auth: TwitterAuth,
): Promise<TwitterUser> {
  const v2client = auth.getV2Client();
  if (!v2client) {
    throw new Error(
      'V2 client is not initialized. Please login with API credentials first.',
    );
  }

  try {
    // First get the user ID from the username
    const user = await v2client.v2.userByUsername(username);
    if (!user.data) {
      throw new Error(`User ${username} not found`);
    }

    // Get the current user's profile
    const currentUser = await auth.me();
    if (!currentUser?.userId) {
      throw new Error(
        'Could not get current user ID. Please ensure you are logged in.',
      );
    }

    // Unfollow the user using their ID
    await v2client.v2.unfollow(currentUser.userId, user.data.id);

    // Return the unfollowed user's information
    return {
      id: user.data.id,
      screenName: user.data.username,
      name: user.data.name,
      profileImageUrl:
        user.data.profile_image_url ||
        'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
      description: user.data.description,
      verified: user.data.verified,
      protected: user.data.protected,
      followersCount: user.data.public_metrics?.followers_count,
      friendsCount: user.data.public_metrics?.following_count,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to unfollow user ${username}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Gets the list of followers for the current account
 * @param auth The Twitter authentication instance
 * @param maxResults Optional maximum number of followers to return (default: 100)
 * @returns An array of TwitterUser objects representing the followers
 */
export async function getMyFollowers(
  auth: TwitterAuth,
  maxResults = 100,
): Promise<TwitterUser[]> {
  const v2client = auth.getV2Client();
  if (!v2client) {
    throw new Error(
      'V2 client is not initialized. Please login with API credentials first.',
    );
  }

  try {
    // Get the current user's profile
    const currentUser = await auth.me();
    if (!currentUser?.userId) {
      throw new Error(
        'Could not get current user ID. Please ensure you are logged in.',
      );
    }

    // Get followers using pagination
    const followers: TwitterUser[] = [];
    let paginationToken: string | undefined;

    do {
      const response = await v2client.v2.followers(currentUser.userId, {
        max_results: Math.min(100, maxResults - followers.length), // Twitter API max is 100 per request
        pagination_token: paginationToken,
        'user.fields': [
          'profile_image_url',
          'description',
          'verified',
          'protected',
          'public_metrics',
        ],
      });

      if (!response.data) {
        break;
      }

      // Convert followers to TwitterUser format
      const newFollowers = response.data.map((user) => ({
        id: user.id,
        screenName: user.username,
        name: user.name,
        profileImageUrl:
          user.profile_image_url ||
          'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
        description: user.description,
        verified: user.verified,
        protected: user.protected,
        followersCount: user.public_metrics?.followers_count,
        friendsCount: user.public_metrics?.following_count,
      }));

      followers.push(...newFollowers);
      paginationToken = response.meta.next_token;

      // Break if we've reached the requested number of followers
      if (followers.length >= maxResults) {
        break;
      }
    } while (paginationToken);

    return followers;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get followers: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Checks if a specific user follows the current account
 * @param username The username of the user to check
 * @param auth The Twitter authentication instance
 * @returns true if the user follows the current account, false otherwise
 */
export async function isFollowingMe(
  username: string,
  auth: TwitterAuth,
): Promise<boolean> {
  const v2client = auth.getV2Client();
  if (!v2client) {
    throw new Error(
      'V2 client is not initialized. Please login with API credentials first.',
    );
  }

  try {
    // Get the user ID from the username
    const user = await v2client.v2.userByUsername(username);
    if (!user.data) {
      throw new Error(`User ${username} not found`);
    }

    // Get the current user's profile
    const currentUser = await auth.me();
    if (!currentUser?.userId) {
      throw new Error(
        'Could not get current user ID. Please ensure you are logged in.',
      );
    }

    // Check if the user follows the current account
    const relationship = await v2client.v2.following(user.data.id, {
      max_results: 1,
      'user.fields': ['id'],
    });

    // Check if the current user is in the following list
    return (
      relationship.data?.some(
        (following) => following.id === currentUser.userId,
      ) ?? false
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to check if ${username} follows you: ${error.message}`,
      );
    }
    throw error;
  }
}
