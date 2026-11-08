$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$checks = 0
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-Check([bool]$condition, [string]$name) {
    $script:checks++
    if (-not $condition) { $script:failures.Add($name) }
}

foreach ($html in Get-ChildItem -LiteralPath $root -Filter '*.html' -File) {
    $content = [System.IO.File]::ReadAllText($html.FullName)
    foreach ($match in [regex]::Matches($content, '(?is)\b(?:src|href)="([^"]+)"')) {
        $reference = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value).Split('#')[0].Split('?')[0]
        if (-not $reference -or $reference -match '^(?:[a-z][a-z0-9+.-]*:|//)') { continue }
        $target = [System.IO.Path]::GetFullPath((Join-Path $root $reference.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
        Assert-Check (Test-Path -LiteralPath $target -PathType Leaf) "$($html.Name) references missing file: $reference"
    }
    Assert-Check (-not [regex]::IsMatch($content, '(?is)<script\b(?![^>]*\bsrc=)[^>]*>.*?</script>')) "$($html.Name) contains inline JavaScript"
    $moduleOrder = @('js/labs/lab-03-09-jobs-applications.js', 'js/labs/lab-10-15-screening-interviews.js', 'js/labs/lab-16-18-hiring-employees.js', 'js/record-actions.js', 'js/app.js')
    $previous = -1
    foreach ($module in $moduleOrder) {
        $position = $content.IndexOf($module, [StringComparison]::OrdinalIgnoreCase)
        Assert-Check ($position -gt $previous) "$($html.Name) loads action modules in the wrong order at $module"
        if ($position -gt $previous) { $previous = $position }
    }
}

$plan = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'TEST-PLAN.md'))
$demo = [System.IO.File]::ReadAllText((Join-Path $root 'manuals/LAB-37-DEMONSTRATION.md'))
$sequence = @('Login', 'Create Job Posting', 'Register Applicant', 'Applicant Applies', 'Validate Application', 'Screen Applicant', 'Determine Screening Result', 'Schedule Interview', 'Conduct Interview', 'Record Interview Evaluation', 'Select Applicant', 'Record Hiring Decision', 'Convert Applicant to Employee', 'Generate Recruitment Reports', 'Display Dashboard', 'Backup Database', 'Logout')
foreach ($document in @(@{ Name = 'status/TEST-PLAN.md'; Text = $plan }, @{ Name = 'manuals/LAB-37-DEMONSTRATION.md'; Text = $demo })) {
    $last = -1
    $sectionMarker = if ($document.Name -eq 'status/TEST-PLAN.md') { '## Final demonstration sequence' } else { '# Lab 37:' }
    $sectionStart = $document.Text.IndexOf($sectionMarker, [StringComparison]::OrdinalIgnoreCase)
    $sectionText = if ($sectionStart -ge 0) { $document.Text.Substring($sectionStart) } else { '' }
    foreach ($step in $sequence) {
        $position = $sectionText.IndexOf($step, [StringComparison]::OrdinalIgnoreCase)
        Assert-Check ($position -gt $last) "$($document.Name) does not contain Lab 37 step in order: $step"
        if ($position -gt $last) { $last = $position }
    }
}

$actions = (Get-ChildItem -LiteralPath (Join-Path $root 'js/labs') -Filter '*.js' -File | ForEach-Object { [System.IO.File]::ReadAllText($_.FullName) }) -join "`n"
$views = [System.IO.File]::ReadAllText((Join-Path $root 'js/page-views.js'))
$schema = [System.IO.File]::ReadAllText((Join-Path $root 'sql/existing-project-extension.sql'))
foreach ($status in @('Under Screening', 'Qualified', 'For Interview', 'Interviewed', 'Selected', 'Hired')) {
    Assert-Check ($actions.Contains($status)) "Workflow code is missing the manual status: $status"
    Assert-Check ($schema.Contains($status)) "Database extension does not accept the workflow status: $status"
}
foreach ($gate in @('Application validation passed', 'Only applicants who passed screening can be scheduled', 'must pass a completed interview before selection', 'selected applicants are ready for a hiring decision')) {
    Assert-Check ($actions.IndexOf($gate, [StringComparison]::OrdinalIgnoreCase) -ge 0) "Lab 37 workflow gate is missing: $gate"
}
foreach ($feature in @('jobDepartmentFilter', 'jobTypeFilter', 'jobStatusFilter', 'Average time-to-hire', 'Job posting and vacancy report', 'Applicants by position', 'Qualified applicants', 'Rejected applicants', 'Hired applicants', 'Applicants per job', 'Screening results', 'Interview results', 'Hires by month', 'There are no confirmed Hired decisions to convert')) {
    Assert-Check ($views.IndexOf($feature, [StringComparison]::OrdinalIgnoreCase) -ge 0) "Workflow report or filter is missing: $feature"
}
$coverage = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'LAB-COVERAGE.md'))
$labNumbers = @([regex]::Matches($coverage, '(?m)^\|\s*(\d+)\s*\|') | ForEach-Object { [int]$_.Groups[1].Value })
Assert-Check (($labNumbers.Count -eq 37) -and (($labNumbers -join ',') -eq ((1..37) -join ','))) 'LAB-COVERAGE.md must list each lab from 1 through 37 exactly once'
Assert-Check ($schema.Contains('enforce_application_workflow_order')) 'Database workflow-order trigger is missing'
Assert-Check ($schema.Contains('enforce_hiring_decision_order')) 'Database hiring-order trigger is missing'
Assert-Check ($schema.Contains('enforce_employee_hiring_source')) 'Employee conversion trigger is missing'
Assert-Check (-not (Test-Path -LiteralPath (Join-Path $root 'start_rms.py'))) 'Removed Python launcher must stay absent'
Assert-Check (-not (Test-Path -LiteralPath (Join-Path $root 'START-RMS.bat'))) 'Removed batch launcher must stay absent'

if (Get-Command node -ErrorAction SilentlyContinue) {
    foreach ($scriptFile in Get-ChildItem -LiteralPath (Join-Path $root 'js') -Filter '*.js' -File -Recurse) {
        & node --check $scriptFile.FullName
        Assert-Check ($LASTEXITCODE -eq 0) "JavaScript syntax check failed: $($scriptFile.Name)"
    }
} else {
    Write-Output 'SKIP: JavaScript parser runtime (Node.js not installed).'
}

if ($failures.Count) {
    Write-Output "FAIL: $($failures.Count) of $checks checks failed."
    $failures | ForEach-Object { Write-Output " - $_" }
    exit 1
}

Write-Output "PASS: $checks release checks."
