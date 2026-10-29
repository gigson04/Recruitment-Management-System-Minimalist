window.RMSRecordActions = function (dependencies) {
    return Object.assign(
        {},
        window.RMSJobApplicationActions(dependencies),
        window.RMSEvaluationActions(dependencies),
        window.RMSHiringActions(dependencies)
    );
};
