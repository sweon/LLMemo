import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const LogItemLink = styled(Link) <{ $isActive: boolean; $inThread?: boolean; $isThreadStart?: boolean; $isThreadEnd?: boolean }>`
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: ${({ $inThread, $isThreadEnd }) => ($inThread && !$isThreadEnd ? '0' : '0.125rem')};
  text-decoration: none;
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.border : 'transparent')};
  color: ${({ theme }) => theme.colors.text};
  
  margin-left: ${({ $inThread }) => ($inThread ? '0' : '0')}; // Reset margin, indentation handled by container
  position: relative;
  
  /* Connector styles if needed, but for nested structure we might use border-left on container */
  ${({ $inThread, theme, $isThreadStart, $isThreadEnd }) => $inThread && `
    &::before {
      content: '';
      position: absolute;
      left: -0.75rem;
      top: ${$isThreadStart ? '50%' : '0'};
      bottom: ${$isThreadEnd ? '50%' : '0'};
      width: 2px;
      background-color: ${theme.colors.border};
      display: none; // Disable old connector style for now
    }
  `}

  &:hover {
    background: ${({ theme, $isActive }) => ($isActive ? theme.colors.border : theme.colors.surface)};
    text-decoration: none;
  }
`;

export const LogTitle = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
`;

export const LogDate = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 0.1rem;
`;

export const ThreadContainer = styled.div`
    border-left: 2px solid ${({ theme }) => theme.colors.border};
    margin-left: 0.75rem;
    padding-left: 0.5rem;
    margin-bottom: 0.5rem;
`;

export const ThreadHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 0.85rem;
    font-weight: 500;
    
    &:hover {
        color: ${({ theme }) => theme.colors.text};
    }
`;
