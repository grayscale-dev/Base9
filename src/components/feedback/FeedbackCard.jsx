import { MessageSquare, ThumbsUp, Link as LinkIcon, Clock, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Badge from '@/components/common/Badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const typeConfig = {
  bug: { label: 'Bug', variant: 'danger', emoji: '🐛' },
  feature_request: { label: 'Feature', variant: 'primary', emoji: '✨' },
  improvement: { label: 'Improvement', variant: 'success', emoji: '📈' },
  question: { label: 'Question', variant: 'warning', emoji: '❓' },
};

const statusConfig = {
  open: { label: 'Open', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'warning' },
  planned: { label: 'Planned', variant: 'primary' },
  in_progress: { label: 'In Progress', variant: 'purple' },
  completed: { label: 'Completed', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
  declined: { label: 'Declined', variant: 'danger' },
};

const priorityConfig = {
  low: { label: 'Low', variant: 'default' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'danger' },
  critical: { label: 'Critical', variant: 'danger' },
};

export default function FeedbackCard({ feedback, onClick, showPriority = false, responseCount = 0 }) {
  const typeInfo = typeConfig[feedback.type] || typeConfig.bug;
  const statusInfo = statusConfig[feedback.status] || statusConfig.open;
  const priorityInfo = feedback.priority ? priorityConfig[feedback.priority] : null;

  return (
    <Card 
      className={cn(
        'p-5 cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:border-slate-300 bg-white'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-base">{typeInfo.emoji}</span>
            <Badge variant={typeInfo.variant} size="sm">
              {typeInfo.label}
            </Badge>
            <Badge variant={statusInfo.variant} size="sm" dot>
              {statusInfo.label}
            </Badge>
            {showPriority && priorityInfo && (
              <Badge variant={priorityInfo.variant} size="sm">
                {priorityInfo.label}
              </Badge>
            )}
            {feedback.roadmap_item_id && (
              <Badge variant="outline" size="sm" className="flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                On Roadmap
              </Badge>
            )}
          </div>
          
          <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">
            {feedback.title}
          </h3>
          
          <p className="text-sm text-slate-500 line-clamp-2 mb-3">
            {feedback.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(feedback.created_date), 'MMM d, yyyy')}
            </span>
            
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {feedback.vote_count || 0}
            </span>
            
            {responseCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {responseCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}