# ![ThunderAI-Sparks icon](images/icon-32px.png "ThunderAI-Sparks") ThunderAI-Sparks
ThunderAI Sparks is an add-on for Thunderbird, designed to add advanced features to ThunderAI.

These are features that ThunderAI itself cannot ship, because they rely on Thunderbird's [experimental APIs](https://developer.thunderbird.net/add-ons/mailextensions/experiments) to access the calendar backend.

> [!IMPORTANT]
> Sparks is a companion add-on: it does nothing on its own.
> To use it, you first need to install [ThunderAI](https://github.com/micz/ThunderAI) **version 5.0.0 or later**.

> [!NOTE]
> If you need to open an issue, go to the ThunderAI repository and use the "Sparks" label: https://github.com/micz/ThunderAI/labels/Sparks

<br>


## Features
- Automatically add a calendar event from a mail message [[#182](https://github.com/micz/ThunderAI/issues/182)], with support for a timezone [[#250](https://github.com/micz/ThunderAI/issues/250)], the attendees [[#258](https://github.com/micz/ThunderAI/issues/258)], the location [[#870](https://github.com/micz/ThunderAI/issues/870)] and the description [[#872](https://github.com/micz/ThunderAI/issues/872)].
- Automatically add a task (todo) from a mail message [[#333](https://github.com/micz/ThunderAI/issues/333)], with support for the location [[#870](https://github.com/micz/ThunderAI/issues/870)] and the description [[#872](https://github.com/micz/ThunderAI/issues/872)].

The native Thunderbird dialog is opened pre-filled, so you always get to review and edit everything before saving.

**Calendar events** can be pre-filled with:

| Field | Since |
|---|---|
| Title, start and end date, all-day flag | 1.0.0 |
| Attendees | 1.1.0 |
| Timezone | 1.1.0 |
| Location | 3.0.0 |
| Description | 3.0.0 |

**Tasks (todos)** can be pre-filled with:

| Field | Since |
|---|---|
| Title, start date, due date | 1.2.0 |
| Timezone | 1.2.0 |
| Location | 3.0.0 |
| Description | 3.0.0 |

> [!NOTE]
> The location and description fields need to be requested from the AI model.
> After updating, be sure to update the prompt in the ThunderAI settings, otherwise those fields will stay empty.

<br>

## How it works
Sparks is only the *executor*: it never talks to an AI model and contains no prompts.

1. **ThunderAI** reads the mail message, asks the configured AI model for the event/task data, and gets back structured JSON.
2. ThunderAI sends that JSON to Sparks through cross-extension messaging.
3. **Sparks** parses it and opens the native Thunderbird calendar or task dialog, pre-filled with the data.

This is why the prompts, the model configuration and the menus all live in ThunderAI: anything about *what* the AI is asked is configured there, while Sparks only takes care of *opening the dialog*.

<br>

## Installation
Install both add-ons from the [ThunderAI add-on page](https://micz.it/thunderbird-addon-thunderai/#sparks). Once Sparks is installed, ThunderAI reloads its menus and the Sparks-enabled entries become available.

<br>

## Compatibility

| ThunderAI Sparks | Requires ThunderAI | Thunderbird |
|---|---|---|
| 3.0.0 | 5.0.0+ | 140 - 156 |
| 2.0.0 | earlier versions | 140 - 148 |
| 1.2.4 | earlier versions | 128 - 147 |
| 1.2.0 - 1.2.3 | earlier versions | 128 - 143 |
| 1.1.0 | earlier versions | 128 - 136 |
| 1.0.0 - 1.0.3 | earlier versions | 128 - 135 |

> [!WARNING]
> Because Sparks uses experimental APIs, it is tightly bound to the Thunderbird version.
> Always use the Sparks version that matches your Thunderbird release.

<br>

## Changelog
ThunderAI-Sparks's changes are logged [here](CHANGELOG.md).


<br>

## Privacy and Permissions
This add-on will ask for [full permission](https://support.mozilla.org/en-US/kb/permission-request-messages-thunderbird-extensions#w_have-full-unrestricted-access-to-thunderbird-and-your-computer), because it's using [Thunderbird experimental API](https://developer.thunderbird.net/add-ons/mailextensions/experiments) to open the new calendar event.

Sparks itself sends no data anywhere: it has no network access, no AI model connection and no telemetry. It only receives data from ThunderAI and passes it to the Thunderbird calendar dialog.

<br>

## Support this addon!
Are you using this addon in your Thunderbird?
<br>Consider to support the development making a small donation. [Click here!](https://www.paypal.com/donate/?business=UHN4SXPGEXWQL&no_recurring=1&item_name=Thunderbird+Addon+ThunderAI-Sparks&currency_code=EUR)

<br>

## Attributions

Thanks to [Philipp](https://github.com/kewisch/) for the help with the experimental calendar API.
