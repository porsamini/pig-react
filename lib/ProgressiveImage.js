/**
 * This class manages a single image. It keeps track of the image's height,
 * width, and position in the grid. An instance of this class is associated
 * with a single image figure, which looks like this:
 *
 *   <figure class="pig-figure" style="transform: ...">
 *     <img class="pig-thumbnail pig-loaded" src="/path/to/thumbnail/image.jpg" />
 *     <img class="pig-loaded" src="/path/to/500px/image.jpg" />
 *   </figure>
 *
 * However, this element may or may not actually exist in the DOM. The actual
 * DOM element may loaded and unloaded depending on where it is with respect
 * to the viewport. This class is responsible for managing the DOM elements,
 * but does not include logic to determine _when_ the DOM elements should
 * be removed.
 *
 * This class also manages the blur-into-focus load effect.  First, the
 * <figure> element is inserted into the page. Then, a very small thumbnail
 * image is then blurred using CSS filter: blur(). Then, the full image is
 * loaded, with opacity:0.  Once it has loaded, it is given the `pig-loaded`
 * class, and its opacity is set to 1.  This creates an effect where there is
 * first a blurred version of the image, and then it appears to come into
 * focus.
 *
 * @param {array} singleImageData - An array of metadata about each image to
 *                                  include in the grid.
 * @param {string} singleImageData[0].filename - The filename of the image.
 * @param {string} singleImageData[0].aspectRatio - The aspect ratio of the
 *                                                  image.
 */
export const ProgressiveImage = function(singleImageData, index, pig) {
  // Global State
  this.existsOnPage = false; // True if the element exists on the page.

  // Instance information
  this.aspectRatio = singleImageData.aspectRatio;  // Aspect Ratio
  this.filename = singleImageData.filename;  // Filename
  this.imageId = singleImageData.imageId || Math.floor(Math.random() * 1000000);  // imageId
  this.index = index;  // The index in the list of images

  // The Pig instance
  this.pig = pig;

  this.classNames = {
    figure: pig.settings.classPrefix + '-figure',
    thumbnail: pig.settings.classPrefix + '-thumbnail',
    loaded: pig.settings.classPrefix + '-loaded',
  };

  /**
   * Load the image element associated with this ProgressiveImage into the DOM.
   *
   * This function will append the figure into the DOM, create and insert the
   * thumbnail, and create and insert the full image.
   */
  this.load = function() {
    // Create a new image element, and insert it into the DOM. It doesn't
    // matter the order of the figure elements, because all positioning
    // is done using transforms.
    this.existsOnPage = true;
    this._updateStyles();
    this.pig.container.appendChild(this.getElement());

    // We run the rest of the function in a 100ms setTimeout so that if the
    // user is scrolling down the page very fast and hide() is called within
    // 100ms of load(), the hide() function will set this.existsOnPage to false
    // and we can exit.
    setTimeout(function() {

      // The image was hidden very quickly after being loaded, so don't bother
      // loading it at all.
      if (!this.existsOnPage) {
        return;
      }

      // Show thumbnail
      if (!this.thumbnail) {
        this.thumbnail = new Image();
        this.thumbnail.src = this.pig.settings.urlForSize(this.filename, this.pig.settings.thumbnailSize);
        this.thumbnail.className = this.classNames.thumbnail;
        this.thumbnail.onload = function() {

          // We have to make sure thumbnail still exists, we may have already been
          // deallocated if the user scrolls too fast.
          if (this.thumbnail) {
            this.thumbnail.className += ' ' + this.classNames.loaded;
          }
        }.bind(this);

        this.getElement().appendChild(this.thumbnail);
      }

      // Show full image
      if (!this.fullImage) {
        this.fullImage = new Image();
        this.fullImage.src = this.pig.settings.urlForSize(this.filename, this.pig.settings.getImageSize(this.pig.lastWindowWidth));
        this.fullImage.onload = function() {

          // We have to make sure fullImage still exists, we may have already been
          // deallocated if the user scrolls too fast.
          if (this.fullImage) {
            this.fullImage.className += ' ' + this.classNames.loaded;
          }
        }.bind(this);

        this.getElement().appendChild(this.fullImage);
      }
    }.bind(this), 100);
  };

  /**
   * Removes the figure from the DOM, removes the thumbnail and full image, and
   * deletes the this.thumbnail and this.fullImage properties off of the
   * ProgressiveImage object.
   */
  this.hide = function() {
    // Remove the images from the element, so that if a user is scrolling super
    // fast, we won't try to load every image we scroll past.
    if (this.getElement()) {
      if (this.thumbnail) {
        this.thumbnail.src = '';
        this.getElement().removeChild(this.thumbnail);
        delete this.thumbnail;
      }

      if (this.fullImage) {
        this.fullImage.src = '';
        this.getElement().removeChild(this.fullImage);
        delete this.fullImage;
      }
    }

    // Remove the image from the DOM.
    if (this.existsOnPage) {
      this.pig.container.removeChild(this.getElement());
    }

    this.existsOnPage = false;

  };

  /**
   * Get the DOM element associated with this ProgressiveImage. We default to
   * using this.element, and we create it if it doesn't exist.
   *
   * @returns {HTMLElement} The DOM element associated with this instance.
   */
  this.getElement = function() {
    if (!this.element) {
      this.element = document.createElement(this.pig.settings.figureTagName);
      this.element.className = this.classNames.figure;
      /**
       * The id will be appended to the figureName. Useful if you want to
       * have control what should happen when you click on the figureName.
       * This can be overridden in options
       */
      this.element.setAttribute('id', this.imageId)
      this.element.onclick = this.pig.settings.onClick.bind(this, this.element);
      this._updateStyles();
    }

    return this.element;
  };

  /**
   * Updates the style attribute to reflect this style property on this object.
   */
  this._updateStyles = function() {
    this.getElement().style.transition = this.style.transition;
    this.getElement().style.width = this.style.width + 'px';
    this.getElement().style.height = this.style.height + 'px';
    this.getElement().style.transform = (
      'translate3d(' + this.style.translateX + 'px,' +
        this.style.translateY + 'px, 0)');
  };

  return this;
}
