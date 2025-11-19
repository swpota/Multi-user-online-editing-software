import React from 'react';
import { stringToColor } from '../../utils/stringUtils';

/**
 * OnlineUsers 组件
 * 显示在线用户列表和远程光标
 */
function OnlineUsers({ 
  onlineUsers = [],
  currentUser,
  remoteCursors = new Map(),
}) {
  // 过滤掉当前用户
  const otherUsers = onlineUsers.filter(u => u.id !== currentUser?.id);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="online-users-container">
      <div className="online-users-label">
        在线用户 ({otherUsers.length})
      </div>
      <div className="online-users-list">
        {otherUsers.map((user) => {
          const userColor = stringToColor(user.username);
          const cursor = remoteCursors.get(user.id);
          
          return (
            <div 
              key={user.id} 
              className="online-user-item"
              title={user.username}
            >
              <div 
                className="user-avatar"
                style={{ 
                  backgroundColor: userColor,
                  border: `2px solid ${userColor}`
                }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user.username}</span>
              {cursor && (
                <span className="user-editing-indicator" title="正在编辑">
                  ✍️
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(OnlineUsers);
