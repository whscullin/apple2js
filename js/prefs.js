/* -*- mode: JavaScript; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* Copyright 2010-2013 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

/*jshint browser: true */
/*exported Prefs */

function Prefs()
{
    return {
        havePrefs: function() {
            return typeof(localStorage) != "undefined";
        },
        readPref: function(name) {
            if (localStorage)
            return localStorage.getItem(name);
            return null;
        },
        writePref: function(name, value) {
            if (localStorage)
            localStorage.setItem(name, value);
        }
    };
}
