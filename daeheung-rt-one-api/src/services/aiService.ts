interface AIAnalysisResult {
  category: string;
  confidence: number;
  insights: string[];
  recommendations: string[];
}

interface UserBehaviorData {
  userId: number;
  actions: string[];
  timestamps: number[];
  duration: number;
}

class AIService {
  // 사용자 행동 패턴 분석
  analyzeUserBehavior(data: UserBehaviorData): AIAnalysisResult {
    const { actions, duration } = data;
    
    // 간단한 패턴 분석 (실제로는 머신러닝 모델 사용)
    const actionFrequency = this.calculateActionFrequency(actions);
    const productivityScore = this.calculateProductivityScore(actions, duration);
    
    let category = 'normal';
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (productivityScore > 0.8) {
      category = 'high_performance';
      insights.push('높은 생산성을 보이고 있습니다.');
      recommendations.push('현재 워크플로우를 유지하세요.');
    } else if (productivityScore < 0.4) {
      category = 'needs_improvement';
      insights.push('생산성 개선이 필요합니다.');
      recommendations.push('작업 우선순위를 재검토해보세요.');
      recommendations.push('집중 시간을 늘려보세요.');
    } else {
      category = 'normal';
      insights.push('안정적인 작업 패턴을 보이고 있습니다.');
      recommendations.push('지속적인 개선을 위해 피드백을 수집해보세요.');
    }

    // 자주 사용하는 기능 분석
    const topActions = Object.entries(actionFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    if (topActions.length > 0) {
      insights.push(`가장 자주 사용하는 기능: ${topActions[0][0]}`);
    }

    return {
      category,
      confidence: 0.85,
      insights,
      recommendations
    };
  }

  // 스마트 메뉴 추천
  recommendMenus(userId: number, currentTime: Date): string[] {
    const hour = currentTime.getHours();
    const recommendations: string[] = [];

    // 시간대별 메뉴 추천
    if (hour >= 9 && hour < 12) {
      recommendations.push('dashboard', 'tasks', 'calendar');
    } else if (hour >= 12 && hour < 14) {
      recommendations.push('reports', 'analytics');
    } else if (hour >= 14 && hour < 18) {
      recommendations.push('projects', 'team', 'communication');
    } else {
      recommendations.push('settings', 'profile', 'help');
    }

    return recommendations;
  }

  // 자동화 제안
  suggestAutomation(userActions: string[]): string[] {
    const suggestions: string[] = [];
    const actionCount = userActions.length;

    // 반복적인 작업 패턴 감지
    const repeatedActions = this.findRepeatedPatterns(userActions);
    
    if (repeatedActions.length > 0) {
      suggestions.push('반복적인 작업을 자동화할 수 있습니다.');
      suggestions.push('워크플로우 템플릿을 생성해보세요.');
    }

    // 자주 사용하는 기능들
    if (actionCount > 50) {
      suggestions.push('자주 사용하는 기능들을 단축키로 설정해보세요.');
    }

    return suggestions;
  }

  // 데이터 기반 인사이트 생성
  generateInsights(data: any[]): string[] {
    const insights: string[] = [];
    
    if (data.length === 0) {
      insights.push('데이터가 부족합니다. 더 많은 활동을 해보세요.');
      return insights;
    }

    // 데이터 분석 로직
    const totalCount = data.length;
    const uniqueUsers = new Set(data.map(item => item.userId)).size;
    
    insights.push(`총 ${totalCount}개의 활동이 기록되었습니다.`);
    insights.push(`${uniqueUsers}명의 사용자가 활동했습니다.`);

    // 트렌드 분석
    const today = new Date();
    const todayData = data.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate.toDateString() === today.toDateString();
    });

    if (todayData.length > totalCount * 0.3) {
      insights.push('오늘 활동량이 평균보다 높습니다.');
    }

    return insights;
  }

  private calculateActionFrequency(actions: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    actions.forEach(action => {
      frequency[action] = (frequency[action] || 0) + 1;
    });
    return frequency;
  }

  private calculateProductivityScore(actions: string[], duration: number): number {
    // 간단한 생산성 점수 계산
    const productiveActions = actions.filter(action => 
      ['create', 'update', 'complete', 'analyze'].includes(action)
    ).length;
    
    const totalActions = actions.length;
    const timeEfficiency = totalActions / (duration / 3600000); // 시간당 액션 수
    
    return Math.min(1, (productiveActions / totalActions) * (timeEfficiency / 10));
  }

  private findRepeatedPatterns(actions: string[]): string[] {
    const patterns: string[] = [];
    const sequence = actions.join(',');
    
    // 간단한 패턴 찾기 (실제로는 더 복잡한 알고리즘 사용)
    for (let i = 0; i < actions.length - 2; i++) {
      const pattern = actions.slice(i, i + 3).join(',');
      const occurrences = (sequence.match(new RegExp(pattern, 'g')) || []).length;
      
      if (occurrences > 1) {
        patterns.push(pattern);
      }
    }
    
    return [...new Set(patterns)];
  }
}

export default new AIService();
