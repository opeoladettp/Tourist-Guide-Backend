#!/usr/bin/env ts-node

/**
 * Comprehensive Integration Test Runner
 * 
 * This script runs all integration tests and generates a detailed report
 * covering API endpoints, security, performance, and end-to-end workflows.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  suiteName: string;
  testCount: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  status: 'PASSED' | 'FAILED' | 'PARTIAL';
}

interface TestReport {
  timestamp: string;
  totalDuration: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  successRate: number;
  suites: TestResult[];
  summary: string;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  constructor() {
    console.log('🚀 Starting Comprehensive Integration Test Suite');
    console.log('================================================');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log('');
  }

  async runTestSuite(suiteName: string, testFile: string): Promise<TestResult> {
    console.log(`🧪 Running ${suiteName}...`);
    const suiteStartTime = Date.now();
    
    try {
      const output = execSync(
        `npx vitest run ${testFile} --reporter=json`,
        { 
          encoding: 'utf-8',
          cwd: process.cwd(),
          timeout: 300000 // 5 minutes timeout
        }
      );

      const result = JSON.parse(output);
      const duration = Date.now() - suiteStartTime;
      
      const testResult: TestResult = {
        suiteName,
        testCount: result.numTotalTests || 0,
        passed: result.numPassedTests || 0,
        failed: result.numFailedTests || 0,
        skipped: result.numPendingTests || 0,
        duration,
        status: result.numFailedTests === 0 ? 'PASSED' : 'FAILED'
      };

      console.log(`✅ ${suiteName} completed: ${testResult.passed}/${testResult.testCount} passed (${duration}ms)`);
      return testResult;

    } catch (error: any) {
      const duration = Date.now() - suiteStartTime;
      console.log(`❌ ${suiteName} failed: ${error.message}`);
      
      return {
        suiteName,
        testCount: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        status: 'FAILED'
      };
    }
  }

  async runAllTests(): Promise<TestReport> {
    const testSuites = [
      {
        name: 'Test Environment Validation',
        file: 'src/tests/integration/test-runner.integration.test.ts'
      },
      {
        name: 'API Endpoints Integration Tests',
        file: 'src/tests/integration/api-endpoints.integration.test.ts'
      },
      {
        name: 'System Admin Workflow Tests',
        file: 'src/tests/integration/system-admin-workflow.integration.test.ts'
      },
      {
        name: 'Provider Admin Workflow Tests',
        file: 'src/tests/integration/provider-admin-workflow.integration.test.ts'
      },
      {
        name: 'Tourist Workflow Tests',
        file: 'src/tests/integration/tourist-workflow.integration.test.ts'
      },
      {
        name: 'Security Integration Tests',
        file: 'src/tests/integration/security.integration.test.ts'
      },
      {
        name: 'Performance Integration Tests',
        file: 'src/tests/integration/performance.integration.test.ts'
      },
      {
        name: 'Business Rules Integration Tests',
        file: 'src/tests/integration/business-rules.integration.test.ts'
      },
      {
        name: 'Error Handling Integration Tests',
        file: 'src/tests/integration/error-handling.integration.test.ts'
      },
      {
        name: 'Tour Event Notifications Tests',
        file: 'src/tests/integration/tour-event-notifications.integration.test.ts'
      }
    ];

    console.log(`📋 Running ${testSuites.length} test suites...\n`);

    for (const suite of testSuites) {
      const result = await this.runTestSuite(suite.name, suite.file);
      this.results.push(result);
      console.log(''); // Add spacing between suites
    }

    return this.generateReport();
  }

  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, r) => sum + r.testCount, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      totalDuration,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      successRate,
      suites: this.results,
      summary: this.generateSummary(totalTests, totalPassed, totalFailed, successRate)
    };

    return report;
  }

  private generateSummary(totalTests: number, totalPassed: number, totalFailed: number, successRate: number): string {
    let summary = '';
    
    if (successRate === 100) {
      summary = '🎉 ALL TESTS PASSED! The integration test suite completed successfully.';
    } else if (successRate >= 90) {
      summary = '✅ MOSTLY SUCCESSFUL! Most tests passed with minor issues.';
    } else if (successRate >= 70) {
      summary = '⚠️ PARTIAL SUCCESS! Some tests failed and need attention.';
    } else {
      summary = '❌ SIGNIFICANT ISSUES! Many tests failed and require immediate attention.';
    }

    return summary;
  }

  printReport(report: TestReport): void {
    console.log('\n📊 INTEGRATION TEST SUITE REPORT');
    console.log('=====================================');
    console.log(`📅 Completed at: ${report.timestamp}`);
    console.log(`⏱️ Total Duration: ${report.totalDuration}ms (${(report.totalDuration / 1000).toFixed(2)}s)`);
    console.log(`📈 Success Rate: ${report.successRate.toFixed(1)}%`);
    console.log('');
    console.log('📊 Overall Results:');
    console.log(`  ✅ Passed: ${report.totalPassed}`);
    console.log(`  ❌ Failed: ${report.totalFailed}`);
    console.log(`  ⏭️ Skipped: ${report.totalSkipped}`);
    console.log(`  📋 Total: ${report.totalTests}`);
    console.log('');
    
    console.log('📁 Test Suite Breakdown:');
    report.suites.forEach((suite, index) => {
      const statusIcon = suite.status === 'PASSED' ? '✅' : '❌';
      const successRate = suite.testCount > 0 ? ((suite.passed / suite.testCount) * 100).toFixed(1) : '0.0';
      console.log(`  ${index + 1}. ${statusIcon} ${suite.suiteName}`);
      console.log(`     Tests: ${suite.passed}/${suite.testCount} passed (${successRate}%)`);
      console.log(`     Duration: ${suite.duration}ms`);
    });
    
    console.log('');
    console.log('🎯 Summary:');
    console.log(`   ${report.summary}`);
    
    if (report.totalFailed > 0) {
      console.log('');
      console.log('🔍 Failed Test Suites:');
      report.suites
        .filter(suite => suite.status === 'FAILED')
        .forEach(suite => {
          console.log(`   ❌ ${suite.suiteName}: ${suite.failed} failed tests`);
        });
    }
    
    console.log('');
    console.log('📋 Test Coverage Areas:');
    console.log('   ✅ API Endpoint Testing');
    console.log('   ✅ End-to-End User Workflows');
    console.log('   ✅ Authentication & Authorization Security');
    console.log('   ✅ Data Isolation & Access Control');
    console.log('   ✅ Input Validation & Error Handling');
    console.log('   ✅ Performance & Load Testing');
    console.log('   ✅ Business Rules Validation');
    console.log('   ✅ Notification System Testing');
    console.log('');
    
    if (report.successRate >= 95) {
      console.log('🏆 EXCELLENT! The API is ready for production deployment.');
    } else if (report.successRate >= 85) {
      console.log('👍 GOOD! Minor issues should be addressed before deployment.');
    } else if (report.successRate >= 70) {
      console.log('⚠️ NEEDS WORK! Several issues need to be resolved.');
    } else {
      console.log('🚨 CRITICAL! Major issues must be fixed before deployment.');
    }
    
    console.log('\n🏁 Integration test suite completed!');
  }

  saveReport(report: TestReport): void {
    const reportPath = join(process.cwd(), 'integration-test-report.json');
    const htmlReportPath = join(process.cwd(), 'integration-test-report.html');
    
    // Save JSON report
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 JSON report saved to: ${reportPath}`);
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    writeFileSync(htmlReportPath, htmlReport);
    console.log(`💾 HTML report saved to: ${htmlReportPath}`);
  }

  private generateHtmlReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report - Tourist Hub API</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .status-passed { background-color: #d4edda; color: #155724; }
        .status-failed { background-color: #f8d7da; color: #721c24; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Integration Test Report</h1>
            <h2>Tourist Hub API</h2>
            <p>Generated on ${report.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value ${report.successRate >= 90 ? 'passed' : report.successRate >= 70 ? 'skipped' : 'failed'}">
                    ${report.successRate.toFixed(1)}%
                </div>
            </div>
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.totalPassed}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.totalFailed}</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value">${(report.totalDuration / 1000).toFixed(2)}s</div>
            </div>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${report.successRate}%"></div>
        </div>
        
        <h3>📋 Test Suites</h3>
        ${report.suites.map(suite => `
            <div class="suite">
                <div class="suite-header ${suite.status === 'PASSED' ? 'status-passed' : 'status-failed'}">
                    ${suite.status === 'PASSED' ? '✅' : '❌'} ${suite.suiteName}
                </div>
                <div class="suite-content">
                    <p><strong>Tests:</strong> ${suite.passed}/${suite.testCount} passed</p>
                    <p><strong>Duration:</strong> ${suite.duration}ms</p>
                    <p><strong>Success Rate:</strong> ${suite.testCount > 0 ? ((suite.passed / suite.testCount) * 100).toFixed(1) : '0.0'}%</p>
                </div>
            </div>
        `).join('')}
        
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
            <h3>📊 Summary</h3>
            <p>${report.summary}</p>
        </div>
    </div>
</body>
</html>`;
  }
}

// Main execution
async function main() {
  const runner = new IntegrationTestRunner();
  
  try {
    const report = await runner.runAllTests();
    runner.printReport(report);
    runner.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.totalFailed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default IntegrationTestRunner;