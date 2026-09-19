# Design: Add Timesheets

## Propose, then confirm, like a period

`subscription close` proposes what the declarations say a month cost and a person commits what was paid.
Hours follow the same shape: `timesheet close` sums each operator's measured hours by spec from the
month's records into one file per operator, keeps that measurement in the file, and stops. The operator
corrects the confirmed column and commits. A read for billing trusts the committed figure and shows the
measured one beside it, so a correction is visible rather than silent.

## The unit stays hours

No timesheet field can hold a rate, the forbidden keys apply, and no read multiplies. What a client is
charged per hour lives outside this repository.
