;(function($, modernizr, window, document, undefined) {
    "use strict";

    /**
     * Product Slider Plugin
     *
     * The plugin provides the functionality to create dynamic product sliders
     * in every part of the shop. Via the config settings you have many options for
     * adjusting the slider to fit your needs. The products for example can be set by
     * the local template or loaded via ajax. Different view options and optional touch
     * gestures make the slider full responsive on any device. See the defaults for all
     * available config options. All config settings can also be set via data attributes.
     *
     * @Example DOM structure:
     * ```
     * <div class="product-slider" data-touchControl="true">
     *     <div class="product-slider--container">
     *         <div class="product--box"></div>
     *         <div class="product--box"></div>
     *         <div class="product--box"></div>
     *     </div>
     * </div>
     * ```
     *
     * ToDo: Add additional functionality like dot navigation or infinite sliding.
     */
    var pluginName = 'productSlider',
        defaults = {
            /**
             * The mode how the products are loaded.
             * @string local | ajax
             */
            mode: 'local',

            /**
             * The category id of the products to load.
             * @integer
             */
            categoryID: 1,

            /**
             * The number of products shown per page.
             * @integer
             */
            perPage: 5,

            /**
             * The number of products moved per slide.
             * @integer
             */
            perSlide: 1,

            /**
             * The maximum of products available to laod via ajax.
             * @integer
             */
            ajaxMaxAvailable: 20,

            /**
             * The maximum of products should be shown via ajax.
             * @integer
             */
            ajaxMaxShow: 20,

            /**
             * Show or hide the arrow buttons.
             * @bool
             */
            showArrows: true,

            /**
             * Active touch gesture controls.
             * @bool
             */
            touchControl: false,

            /**
             * Active automatic sliding.
             * @bool
             */
            autoSlide: false,

            /**
             * Set the interval of the automatic sliding.
             * @integer
             */
            autoSlideInterval: 4000,

            /**
             * Set the speed of a single slide animation.
             * @integer
             */
            animationSpeed: 300,

            /**
             * Set the controller url which returns the products loaded via ajax.
             * @string
             */
            controllerUrl: '/widgets/emotion/emotionArticleSlider',

            /**
             * An additional css class for the wrapper element.
             * @string
             */
            wrapperClass: 'product-slider',

            /**
             * The css class of the slider element.
             * @string
             */
            containerClass: 'product-slider--container',

            /**
             * The css class of a single slider item.
             * @string
             */
            itemClass: 'product--box',

            /**
             * The css class of the left arrow button.
             * @string
             */
            arrowClassLeft: 'product-slider--arrow is--left',

            /**
             * The css class of the right arrow button.
             * @string
             */
            arrowClassRight: 'product-slider--arrow is--right'
        };

    /**
     * Plugin constructor which merges the default settings with the user settings.
     *
     * @param {HTMLElement} element - Element which should be used in the plugin
     * @param {Object} userOpts - User settings for the plugin
     * @constructor
     */
    function Plugin(element, userOpts) {
        var me = this;

        me.$el = $(element);

        me.opts = $.extend({}, defaults, userOpts);

        me.getDataConfig();

        me._defaults = defaults;
        me._name = pluginName;

        me.itemsCount = 0;
        me.slideIndex = 0;
        me.slideInterval = false;
        me.touchEvent = {};

        me.$items = false;

        me.itemsMaxShow = (me.opts.ajaxMaxShow > me.opts.ajaxMaxAvailable) ? me.opts.ajaxMaxAvailable : me.opts.ajaxMaxShow;

        me.$el.addClass(me.opts.wrapperClass);

        me.$container = me.createSlideContainer();
        me.createItems();
    }

    /**
     * Loads config settings which are set via data attributes and
     * overrides the old setting with the data attribute of the
     * same name if defined.
     */
    Plugin.prototype.getDataConfig = function() {
        var me = this,
            attr;

        $.each(me.opts, function(key, value) {
            attr = me.$el.attr('data-' + key);
            if ( attr !== undefined ) {
                me.opts[key] = attr;
            }
        });
    };

    /**
     * Initializes the plugin and calls all necessary functions.
     */
    Plugin.prototype.init = function() {
        var me = this;

        me.checkActiveState();

        me.setSizes();
        me.setPosition();
        me.createArrows();
        me.registerEvents();

        if (me.opts.autoSlide && me.active) {
            me.startAutoSlide();
        }
    };

    /**
     * Checks if there are enough items
     * and actives the slider if necessary.
     */
    Plugin.prototype.checkActiveState = function() {
        var me = this;

        me.active = (me.itemsCount > me.opts.perPage);
    };

    /**
     * Gets the container element of the sliding items.
     * Creates a new container if no element is found.
     */
    Plugin.prototype.createSlideContainer = function() {
        var me = this,
            container = me.$el.find('.' + me.opts.containerClass);

        if (!container.length) {
            container = $('<div>', {
                'class': me.opts.containerClass
            }).appendTo(me.$el);
        }

        return container;
    };

    /**
     * Creates the slider items.
     * Calls the init function if after the products are loaded.
     */
    Plugin.prototype.createItems = function() {
        var me = this,
            loadCount = me.opts.perPage * 2;

        if (loadCount < 4) loadCount = 4;
        if (loadCount > me.itemsMaxShow) loadCount = me.itemsMaxShow;

        if (me.opts.mode == 'ajax') {
            me.loadItems(0, loadCount, function(response) {
                me.$container.html(response);
                me.trackItems();
                me.init();
            });
        } else {
            me.trackItems();
            me.init();
        }
    };

    /**
     * Tracks all slider items and sets some necessary variables.
     * Is called on initialization and on every slide to update the information.
     */
    Plugin.prototype.trackItems = function() {
        var me = this;

        me.$items = me.$container.find('.' + me.opts.itemClass);

        me.itemsCount = me.$items.length;

        me.itemsMaxCount = (me.opts.mode == 'ajax') ? me.opts.ajaxMaxAvailable : me.itemsCount;

        me.twoPages = me.opts.perPage * 2;
        me.minIndex = 0;
        me.maxIndex = (me.opts.mode == 'ajax') ? me.itemsMaxShow - me.opts.perPage : me.itemsCount - me.opts.perPage;

        me.itemsToLoad = me.itemsMaxShow - me.itemsCount;
    };

    /**
     * Loads products via ajax.
     *
     * @integer start
     * @integer limit
     * @function callback
     */
    Plugin.prototype.loadItems = function(start, limit, callback) {
        var me = this,
            cb = callback || function() {};

        $.ajax({
            url: me.opts.controllerUrl,
            method: 'POST',
            data: {
                'category': me.opts.categoryID,
                'start': start,
                'limit': limit
            },
            success: function(response) {
                cb.call(me, response);
            }
        });
    };

    /**
     * Sets the sizes of the container and the slider items.
     * Triggers also the picturefill method to adjust the product images.
     */
    Plugin.prototype.setSizes = function() {
        var me = this;

        me.wrapperWidth = me.$el.outerWidth();
        me.itemsWidth = me.wrapperWidth / me.opts.perPage;

        me.$items.css({ width: me.itemsWidth });
        me.$container.stop(true, true).css({ width: me.itemsCount * me.itemsWidth + 20 });

        me.setPosition(me.slideIndex);

        // Also handle new loaded images bye the picturefill
        window.picturefill();
    };

    /**
     * Set the position of the slider directly to a given item index.
     *
     * @integer index
     */
    Plugin.prototype.setPosition = function(index) {
        var me = this,
            i = index || me.slideIndex;

        me.$container.css({ left: - ( i * me.itemsWidth ) });
    };

    /**
     * Registers all necessary event handlers.
     */
    Plugin.prototype.registerEvents = function() {
        var me = this;

        $(window).on('resize.' + pluginName, $.proxy(me.setSizes, me));

        me.$arrowLeft.on('click.' + pluginName, function(e) {
            e.preventDefault();
            me.slidePrev();
        });
        me.$arrowRight.on('click.' + pluginName, function(e) {
            e.preventDefault();
            me.slideNext();
        });

        if (me.opts.touchControl) {
            me.$el.on('swipeleft.' + pluginName, $.proxy(me.slideNext, me));
            me.$el.on('swiperight.' + pluginName, $.proxy(me.slidePrev, me));

            // Touch scrolling fix
            me.$el.on('movestart.' + pluginName, function(e) {
                if ((e.distX > e.distY && e.distX < -e.distY) ||
                    (e.distX < e.distY && e.distX > -e.distY)) {
                    e.preventDefault();
                }
            });
        }

        if (me.opts.autoSlide) {
            me.$el.on('mouseenter.' + pluginName, $.proxy(me.stopAutoSlide, me));
            me.$el.on('mouseleave.' + pluginName, $.proxy(me.startAutoSlide, me));
        }

        $.subscribe('plugin/tabContent/onChangeTab', function() {
            me.setSizes();
            me.setPosition(me.slideIndex);
        });
    };

    /**
     * Creates the arrow buttons.
     */
    Plugin.prototype.createArrows = function() {
        var me = this;

        if (!me.opts.showArrows) {
            return;
        }

        if (!me.$arrowLeft) {
            me.$arrowLeft = $('<a>', {
                'class': me.opts.arrowClassLeft
            }).prependTo(me.$el);
        }

        if (!me.$arrowRight) {
            me.$arrowRight = $('<a>', {
                'class': me.opts.arrowClassRight
            }).prependTo(me.$el);
        }

        me.trackArrows();
    };

    /**
     * Tracks the view of the arrow buttons.
     * Hides the specific arrow button when the slider comes to last item.
     */
    Plugin.prototype.trackArrows = function() {
        var me = this;

        if (!me.active) {
            me.$arrowRight.hide();
            me.$arrowLeft.hide();
            return;
        }

        me.$arrowRight[( me.slideIndex == me.maxIndex ) ? 'hide' : 'show']();
        me.$arrowLeft[( me.slideIndex == me.minIndex ) ? 'hide' : 'show']();
    };

    /**
     * Starts the automatic sliding.
     * Calls slideNext() in the configured interval.
     */
    Plugin.prototype.startAutoSlide = function() {
        var me = this;

        if (!me.active) {
            return;
        }

        me.slideInterval = window.setInterval(function(){
            me.slideNext();
        }, me.opts.autoSlideInterval);
    };

    /**
     * Stops the automatic sliding.
     */
    Plugin.prototype.stopAutoSlide = function() {
        var me = this;

        window.clearInterval(me.slideInterval);
    };

    /**
     * Handles the sliding forward to next items.
     * Loads new products via ajax if necessary.
     */
    Plugin.prototype.slideNext = function() {
        var me = this,
            newIndex = me.slideIndex + me.opts.perSlide,
            itemsLeftToSlideNext = me.itemsCount - (me.slideIndex + me.opts.perPage),
            offset = me.opts.perPage;

        if (!me.active) {
            return;
        }

        if ( me.opts.perSlide > itemsLeftToSlideNext ) {
            newIndex = me.slideIndex + itemsLeftToSlideNext;
        }

        if ( newIndex <= me.maxIndex ) {
            me.slide(newIndex);
        }

        if ( me.opts.mode == 'ajax'
            && me.itemsToLoad > 0
            && me.itemsMaxShow > me.itemsCount) {

            if (offset < 4) offset = 4;
            if ( me.opts.perPage < me.itemsToLoad ) offset = me.itemsToLoad;

            me.loadItems(me.itemsCount, offset, function(response) {
                me.$container.append(response);
                me.trackItems();
                me.setSizes();
            });
        }
    };

    /**
     * Handles the sliding backwards to previous items.
     */
    Plugin.prototype.slidePrev = function() {
        var me = this,
            newIndex = me.slideIndex - me.opts.perSlide;

        if (!me.active) {
            return;
        }

        if ( me.opts.perSlide > me.slideIndex ) {
            newIndex = 0;
        }

        if ( newIndex >= me.minIndex ) {
            me.slide(newIndex);
        }
    };

    /**
     * Basic slide function which handles the animation based on the new index.
     * Is called by slideNext() and slidePrev().
     *
     * @integer index
     * @function callback
     */
    Plugin.prototype.slide = function(index, callback) {
        var me = this,
            newPosition = -(index * me.itemsWidth) + 'px',
            afterSlide = callback || function() {};

        if (!me.active) {
            return;
        }

        me.slideIndex = index;

        me.trackArrows();

        if (modernizr.csstransitions) {
            me.$container.transition({ left: newPosition }, me.opts.animationSpeed, afterSlide);
        } else {
            me.$container.animate({ left: newPosition }, me.opts.animationSpeed, afterSlide);
        }
    };

    /**
     * Will be called, when two breakpoints are switching but the configuration hasn't changed
     */
    Plugin.prototype.update = function() { };

    /**
     * Destroyes the initialized plugin completely, so all event listeners will
     * be removed and the plugin data, which is stored in-memory referenced to
     * the DOM node.
     */
    Plugin.prototype.destroy = function() {
        var me = this;

        me.stopAutoSlide();

        me.$arrowLeft.off('click.' + pluginName).remove();
        me.$arrowRight.off('click.' + pluginName).remove();

        me.$el.off('mouseenter.' + pluginName);
        me.$el.off('mouseleave.' + pluginName);
        me.$el.off('swipeleft.' + pluginName);
        me.$el.off('swiperight.' + pluginName);
        me.$el.off('movestart.' + pluginName);

        $(window).off('resize.' + pluginName);

        me.$el.removeData('plugin_' + pluginName);
    };

    $.fn[pluginName] = function ( options ) {
        return this.each(function () {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName,
                    new Plugin( this, options ));
            }
        });
    };

})(jQuery, Modernizr, window, document);