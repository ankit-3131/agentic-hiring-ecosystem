import React from 'react';
import { User } from '../../types';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    user: Pick<User, 'name' | 'profilePictureUrl'>;
}

const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({ user, className, ...props }) => {
    return (
        <div
            className={`relative inline-flex items-center justify-center w-10 h-10 overflow-hidden bg-muted rounded-full ${className}`}
            {...props}
        >
            {user.profilePictureUrl ? (
                <img
                    src={user.profilePictureUrl}
                    alt={user.name}
                    className="w-full h-full object-cover"
                />
            ) : (
                <span className="font-medium text-muted-foreground">
                    {getInitials(user.name)}
                </span>
            )}
        </div>
    );
};

export default Avatar;
