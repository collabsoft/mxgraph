/**
 * $Id: Graph.js,v 1.29 2012-05-02 22:28:01 gaudenz Exp $
 * Copyright (c) 2006-2012, JGraph Ltd
 */
/**
 * Constructs a new graph instance. Note that the constructor does not take a
 * container because the graph instance is needed for creating the UI, which
 * in turn will create the container for the graph. Hence, the container is
 * assigned later in EditorUi.
 */
Graph = function(container, model, renderHint, stylesheet)
{
	mxGraph.call(this, container, model, renderHint, stylesheet);
	
	this.setConnectable(true);
	this.setDropEnabled(true);
	this.setPanning(true);
	this.setTooltips(!mxClient.IS_TOUCH);
	this.setAllowLoops(true);
	this.allowAutoPanning = true;
	
	this.connectionHandler.setCreateTarget(true);

	// Sets the style to be used when an elbow edge is double clicked
	this.alternateEdgeStyle = 'vertical';
	this.loadStylesheet();
	
	// Creates rubberband selection
    var rubberband = new mxRubberband(this);
    
    this.getRubberband = function()
    {
    	return rubberband;
    };
    
    // Adds support for HTML labels via style. Note: Currently, only the Java
    // backend supports HTML labels but CSS support is limited to the following:
    // http://docs.oracle.com/javase/6/docs/api/index.html?javax/swing/text/html/CSS.html
	this.isHtmlLabel = function(cell)
	{
		var state = this.view.getState(cell);
		var style = (state != null) ? state.style : this.getCellStyle(cell);
		
		return style['html'] == '1';
	};
	
	// Unlocks all cells
	this.isCellLocked = function(cell)
	{
		return false;
	};

	// Tap and hold brings up context menu.
	// Tolerance slightly below graph tolerance is better.
	this.connectionHandler.tapAndHoldTolerance = 16;
	
	//  Tap and hold on background starts rubberband on cell starts connecting
	var connectionHandlerTapAndHold = this.connectionHandler.tapAndHold;
	this.connectionHandler.tapAndHold = function(me, state)
	{
		if (state == null)
		{
			if (!this.graph.panningHandler.active)
			{
				rubberband.start(me.getGraphX(), me.getGraphY());
				this.graph.panningHandler.panningTrigger = false;
			}
		}
		else if (tapAndHoldStartsConnection)
		{
			connectionHandlerTapAndHold.apply(this, arguments);	
		}
		else if (this.graph.isCellSelected(state.cell) && this.graph.getSelectionCount() > 1)
		{
			this.graph.removeSelectionCell(state.cell);
		}
	};

	if (touchStyle)
	{
		this.initTouch();
	}
};

// Graph inherits from mxGraph
mxUtils.extend(Graph, mxGraph);

/**
 * Loads the stylesheet for this graph.
 */
Graph.prototype.loadStylesheet = function()
{
    var node = mxUtils.load(STYLE_PATH + '/default.xml').getDocumentElement();
	var dec = new mxCodec(node.ownerDocument);
	dec.decode(node, this.getStylesheet());
};

/**
 * Inverts the elbow edge style without removing existing styles.
 */
Graph.prototype.flipEdge = function(edge)
{
	if (edge != null)
	{
		var state = this.view.getState(edge);
		var style = (state != null) ? state.style : this.getCellStyle(edge);
		
		if (style != null)
		{
			var elbow = mxUtils.getValue(style, mxConstants.STYLE_ELBOW,
				mxConstants.ELBOW_HORIZONTAL);
			var value = (elbow == mxConstants.ELBOW_HORIZONTAL) ?
				mxConstants.ELBOW_VERTICAL : mxConstants.ELBOW_HORIZONTAL;
			this.setCellStyles(mxConstants.STYLE_ELBOW, value, [edge]);
		}
	}
};

/**
 * Disables folding for non-swimlanes.
 */
Graph.prototype.isCellFoldable = function(cell)
{
	return this.foldingEnabled && this.isSwimlane(cell);
};

/**
 * Disables drill-down for non-swimlanes.
 */
Graph.prototype.isValidRoot = function(cell)
{
	return this.isSwimlane(cell);
};

/**
 * Overrides createGroupCell to set the group style for new groups to 'group'.
 */
Graph.prototype.createGroupCell = function()
{
	var group = mxGraph.prototype.createGroupCell.apply(this, arguments);
	group.setStyle('group');
	
	return group;
};

/**
 * Overrides tooltips to show position and size
 */
Graph.prototype.getTooltipForCell = function(cell)
{
	var tip = '';
	
	if (this.getModel().isVertex(cell))
	{
		var geo = this.getCellGeometry(cell);
		
		var f2 = function(x)
		{
			return Math.round(parseFloat(x) * 100) / 100;
		};
		
		if (geo != null)
		{
			if (tip == null)
			{
				tip = '';
			}
			else if (tip.length > 0)
			{
				tip += '\n';
			}
			
			tip += 'X: ' + f2(geo.x) + '\nY: ' + f2(geo.y) + '\nW: ' + f2(geo.width) + '\nH: ' + f2(geo.height);
		}
	}
	else if (this.getModel().isEdge(cell))
	{
		tip = mxGraph.prototype.getTooltipForCell.apply(this, arguments);
	}
	
	return tip;
};

/**
 * Customized graph for touch devices.
 */
Graph.prototype.initTouch = function()
{
	// Disables new connections via "hotspot"
	this.connectionHandler.marker.isEnabled = function()
	{
		return this.graph.connectionHandler.first != null;
	};

	// Hides menu when editing starts
	this.addListener(mxEvent.START_EDITING, function(sender, evt)
	{
		this.panningHandler.hideMenu();
	});

	// Context menu for touchstyle
	var showMenu = false;
	var menuCell = null;

	// Checks if native hit detection did not return anything and does custom
	// hit detection for edges to take into account the tolerance
	this.updateMouseEvent = function(me)
	{
		mxGraph.prototype.updateMouseEvent.apply(this, arguments);

		if (me.getState() == null)
		{
			var cell = this.getCellAt(me.graphX, me.graphY);
			
			if (this.getModel().isEdge(cell))
			{
				me.state = this.view.getState(cell);
				
				if (me.state != null && me.state.shape != null)
				{
					this.container.style.cursor = me.state.shape.node.style.cursor;
				}
			}
		}
		
		if (me.getState() == null)
		{
			this.container.style.cursor = 'default';
		}
	};
	
	// Handles popup menu on touch devices (tap selected cell)
	this.fireMouseEvent = function(evtName, me, sender)
	{
		if (evtName == mxEvent.MOUSE_DOWN)
		{
			if (!this.panningHandler.isMenuShowing())
			{
				menuCell = me.getCell();
				showMenu = (menuCell != null) ? this.isCellSelected(menuCell) : this.isSelectionEmpty();
			}
			else
			{
				showMenu = false;
				menuCell = null;
			}
		}
		else if (evtName == mxEvent.MOUSE_UP)
		{
			if (showMenu && !this.isEditing())
			{
				if (!this.panningHandler.isMenuShowing())
				{
					var x = mxEvent.getClientX(me.getEvent());
					var y = mxEvent.getClientY(me.getEvent());
					
					this.panningHandler.popup(x + 16, y, menuCell, me.getEvent());
				}
				
				showMenu = false;
				menuCell = null;
				me.consume();
				
				return;
			}
			
			showMenu = false;
			menuCell = null;
		}

		mxGraph.prototype.fireMouseEvent.apply(this, arguments);

		if (evtName == mxEvent.MOUSE_MOVE && me.isConsumed())
		{
			showMenu = false;
			menuCell = null;
		}
	};
};

/**
 * Registers shapes.
 */
(function()
{
	// Touch-specific static overrides
	if (touchStyle)
	{
		// Sets constants for touch style
		mxConstants.HANDLE_SIZE = 16;
		mxConstants.LABEL_HANDLE_SIZE = 7;
		
		// Larger tolerance and grid for real touch devices
		if (mxClient.IS_TOUCH)
		{
			mxVertexHandler.prototype.tolerance = 4;
			mxEdgeHandler.prototype.tolerance = 6;
			Graph.prototype.tolerance = 14;
			Graph.prototype.gridSize = 20;
			
			// One finger pans (no rubberband selection) must start regardless of mouse button
			mxPanningHandler.prototype.selectOnPopup = false;
			mxPanningHandler.prototype.useLeftButtonForPanning = true;
			mxPanningHandler.prototype.isPanningTrigger = function(me)
			{
				var evt = me.getEvent();
			 	
			 	return (this.useLeftButtonForPanning && (this.ignoreCell || me.getState() == null)/* &&
			 			mxEvent.isLeftMouseButton(evt)*/) || (mxEvent.isControlDown(evt) &&
			 			mxEvent.isShiftDown(evt)) || (this.usePopupTrigger &&
			 		   	mxEvent.isPopupTrigger(evt));
			};
		}
		
		// Don't clear selection if multiple cells selected
		var graphHandlerMouseDown = mxGraphHandler.prototype.mouseDown;
		mxGraphHandler.prototype.mouseDown = function(sender, me)
		{
			graphHandlerMouseDown.apply(this, arguments);

			if (this.graph.isCellSelected(me.getCell()) && this.graph.getSelectionCount() > 1)
			{
				this.delayedSelection = false;
			}
		};

		// Changes order of panninghandler
		Graph.prototype.createHandlers = function(container)
		{
			this.tooltipHandler = new mxTooltipHandler(this);
			this.tooltipHandler.setEnabled(false);
			// Selection cells first
			this.selectionCellsHandler = new mxSelectionCellsHandler(this);
			this.panningHandler = new mxPanningHandler(this);
			this.panningHandler.panningEnabled = false;
			this.connectionHandler = new mxConnectionHandler(this);
			this.connectionHandler.setEnabled(false);
			this.graphHandler = new mxGraphHandler(this);
		};

		// On connect the target is selected and we clone the cell of the preview edge for insert
		mxConnectionHandler.prototype.selectCells = function(edge, target)
		{
			if (touchStyle && target != null)
			{
				this.graph.setSelectionCell(target);
			}
			else
			{
				this.graph.setSelectionCell(edge);
			}
		};

		// Overrides double click handling to use the tolerance
		// FIXME: Double click on edges in iPad needs focus on textarea
		var graphDblClick = mxGraph.prototype.dblClick;
		Graph.prototype.dblClick = function(evt, cell)
		{
			if (cell == null)
			{
				var pt = mxUtils.convertPoint(this.container,
					mxEvent.getClientX(evt), mxEvent.getClientY(evt));
				cell = this.getCellAt(pt.x, pt.y);
			}

			graphDblClick.call(this, evt, cell);
		};
		
		
		// Sets the submenu icon
		mxPopupMenu.prototype.submenuImage = IMAGE_PATH + '/touch-submenu.png';
		
		// Rounded edge and vertex handles
		var touchHandle = new mxImage(IMAGE_PATH + '/touch-handle.png', 16, 16);
		mxVertexHandler.prototype.handleImage = touchHandle;
		mxEdgeHandler.prototype.handleImage = touchHandle;
		mxOutline.prototype.sizerImage = touchHandle;
		
		// Pre-fetches touch handle
		new Image().src = touchHandle.src;

		// Adds connect icon to selected vertices
		var connectorSrc = IMAGE_PATH + '/touch-connector.png';
		
		var vertexHandlerInit = mxVertexHandler.prototype.init;
		mxVertexHandler.prototype.init = function()
		{
			vertexHandlerInit.apply(this, arguments);
			var md = (mxClient.IS_TOUCH) ? 'touchstart' : 'mousedown';

			// Only show connector image on one cell and do not show on containers
			if (showConnectorImg && this.graph.connectionHandler.isEnabled() &&
				this.graph.isCellConnectable(this.state.cell) &&
				!this.graph.isValidRoot(this.state.cell) &&
				this.graph.getSelectionCount() == 1)
			{
				this.connectorImg = mxUtils.createImage(connectorSrc);
				this.connectorImg.style.cursor = 'pointer';
				this.connectorImg.style.width = '29px';
				this.connectorImg.style.height = '29px';
				this.connectorImg.style.position = 'absolute';
				
				if (!mxClient.IS_TOUCH)
				{
					this.connectorImg.setAttribute('title', mxResources.get('connect'));
					mxEvent.redirectMouseEvents(this.connectorImg, this.graph, this.state);
				}

				// Adds 2px tolerance
				this.connectorImg.style.padding = '2px';
				
				// Starts connecting on touch/mouse down
				mxEvent.addListener(this.connectorImg, md,
					mxUtils.bind(this, function(evt)
					{
						this.graph.panningHandler.hideMenu();
						var pt = mxUtils.convertPoint(this.graph.container,
								mxEvent.getClientX(evt), mxEvent.getClientY(evt));
						this.graph.connectionHandler.start(this.state, pt.x, pt.y);
						this.graph.isMouseDown = true;
						mxEvent.consume(evt);
					})
				);

				this.graph.container.appendChild(this.connectorImg);
			}

			this.redrawTools();
		};
		
		var vertexHandlerRedraw = mxVertexHandler.prototype.redraw;
		mxVertexHandler.prototype.redraw = function()
		{
			vertexHandlerRedraw.apply(this);
			this.redrawTools();
		};
		
		mxVertexHandler.prototype.redrawTools = function()
		{
			if (this.state != null && this.connectorImg != null)
			{
				// Top right for single-sizer
				if (mxVertexHandler.prototype.singleSizer)
				{
					this.connectorImg.style.left = (this.state.x + this.state.width - this.connectorImg.offsetWidth / 2) + 'px';
					this.connectorImg.style.top = (this.state.y - this.connectorImg.offsetHeight / 2) + 'px';
				}
				else
				{
					this.connectorImg.style.left = (this.state.x + this.state.width + mxConstants.HANDLE_SIZE / 2 + 4/* - 2 padding*/) + 'px';
					this.connectorImg.style.top = (this.state.y + (this.state.height - this.connectorImg.offsetHeight) / 2) + 'px';
				}
			}
		};
		
		var vertexHandlerDestroy = mxVertexHandler.prototype.destroy;
		mxVertexHandler.prototype.destroy = function(sender, me)
		{
			vertexHandlerDestroy.apply(this, arguments);

			if (this.connectorImg != null)
			{
				this.connectorImg.parentNode.removeChild(this.connectorImg);
				this.connectorImg = null;
			}
		};
		
		// Pre-fetches touch connector
		new Image().src = connectorSrc;
	}
	else // not touchStyle
	{
		mxConnectionHandler.prototype.connectImage = new mxImage(IMAGE_PATH + '/connector.png', 15, 15);
	}

	// Pre-fetches submenu image
	new Image().src = mxPopupMenu.prototype.submenuImage;

	// Pre-fetches connect image
	if (mxConnectionHandler.prototype.connectImage != null)
	{
		new Image().src = mxConnectionHandler.prototype.connectImage.src;
	}
	
	// Cube Shape, supports size style
	function CubeShape() { };
	CubeShape.prototype = new mxCylinder();
	CubeShape.prototype.constructor = CubeShape;
	CubeShape.prototype.size = 20;
	CubeShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var s = mxUtils.getValue(this.style, 'size', this.size);
		var dy = s * this.scale;
		var dx = s * this.scale;

		if (isForeground)
		{
			path.moveTo(dx, h);
			path.lineTo(dx, dy);
			path.lineTo(0, 0);
			path.moveTo(dx, dy);
			path.lineTo(w, dy);
			path.end();
		}
		else
		{
			path.moveTo(0, 0);
			path.lineTo(w - dx, 0);
			path.lineTo(w, dy);
			path.lineTo(w, h);
			path.lineTo(dx, h);
			path.lineTo(0, h - dy);
			path.lineTo(0, 0);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['cube'] = CubeShape;

	// Note Shape, supports size style
	function NoteShape() { };
	NoteShape.prototype = new mxCylinder();
	NoteShape.prototype.constructor = NoteShape;
	NoteShape.prototype.size = 30;
	NoteShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var s = mxUtils.getValue(this.style, 'size', this.size);
		var dx = s * this.scale;
		var dy = s * this.scale;

		if (isForeground)
		{
			path.moveTo(w - dx, 0);
			path.lineTo(w - dx, dy);
			path.lineTo(w, dy);
			path.end();
		}
		else
		{
			path.moveTo(0, 0);
			path.lineTo(w - dx, 0);
			path.lineTo(w, dy);
			path.lineTo(w, h);
			path.lineTo(0, h);
			path.lineTo(0, 0);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['note'] = NoteShape;

	// Folder Shape, supports tabWidth, tabHeight styles
	function FolderShape() { };
	FolderShape.prototype = new mxCylinder();
	FolderShape.prototype.constructor = FolderShape;
	FolderShape.prototype.tabWidth = 60;
	FolderShape.prototype.tabHeight = 20;
	FolderShape.prototype.tabPosition = 'right';
	FolderShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var tw = mxUtils.getValue(this.style, 'tabWidth', this.tabWidth);
		var th = mxUtils.getValue(this.style, 'tabHeight', this.tabHeight);
		var tp = mxUtils.getValue(this.style, 'tabPosition', this.tabPosition);
		var dx = tw * this.scale;
		var dy = th * this.scale;

		if (isForeground)
		{
			if (tp == 'left')
			{
				path.moveTo(0, dy);
				path.lineTo(dx, dy);
			}
			// Right is default
			else
			{
				path.moveTo(w - dx, dy);
				path.lineTo(w, dy);
			}
			
			path.end();
		}
		else
		{
			if (tp == 'left')
			{
				path.moveTo(0, 0);
				path.lineTo(dx, 0);
				path.lineTo(dx, dy);
				path.lineTo(w, dy);
			}
			// Right is default
			else
			{
				path.moveTo(0, dy);
				path.lineTo(w - dx, dy);
				path.lineTo(w - dx, 0);
				path.lineTo(w, 0);
			}
			
			path.lineTo(w, h);
			path.lineTo(0, h);
			path.lineTo(0, dy);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['folder'] = FolderShape;

	// Card Shape, supports size style
	function CardShape() { };
	CardShape.prototype = new mxCylinder();
	CardShape.prototype.constructor = CardShape;
	CardShape.prototype.size = 30;
	CardShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var s = mxUtils.getValue(this.style, 'size', this.size);
		var dx = s * this.scale;
		var dy = s * this.scale;

		if (!isForeground)
		{
			path.moveTo(dx, 0);
			path.lineTo(w, 0);
			path.lineTo(w, h);
			path.lineTo(0, h);
			path.lineTo(0, dy);
			path.lineTo(dx, 0);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['card'] = CardShape;

	// Tape Shape, supports size style
	function TapeShape() { };
	TapeShape.prototype = new mxCylinder();
	TapeShape.prototype.constructor = TapeShape;
	TapeShape.prototype.size = 0.4;
	TapeShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var s = mxUtils.getValue(this.style, 'size', this.size);
		var dy = h * s;
		var fy = 1.4;

		if (!isForeground)
		{
			path.moveTo(0, dy / 2);
			path.quadTo(w / 4, dy * fy, w / 2, dy / 2);
			path.quadTo(w * 3 / 4, dy * (1 - fy), w, dy / 2);
			path.lineTo(w, h - dy / 2);
			path.quadTo(w * 3 / 4, h - dy * fy, w / 2, h - dy / 2);
			path.quadTo(w / 4, h - dy * (1 - fy), 0, h - dy / 2);
			path.lineTo(0, dy / 2);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['tape'] = TapeShape;

	// Tape Shape, supports size style
	function PlusShape() { };
	PlusShape.prototype = new mxCylinder();
	PlusShape.prototype.constructor = PlusShape;
	PlusShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var border = Math.min(w / 5, h / 5) + 1;
		
		if (isForeground)
		{
			path.moveTo(w / 2, border);
			path.lineTo(w / 2, h - border);
			path.moveTo(border, h / 2);
			path.lineTo(w - border, h / 2);
			path.end();
		}
		else
		{
			path.moveTo(0, 0);
			path.lineTo(w, 0);
			path.lineTo(w, h);
			path.lineTo(0, h);
			path.close();
		}
	};

	mxCellRenderer.prototype.defaultShapes['plus'] = PlusShape;

	// Tape Shape, supports size style
	function MessageShape() { };
	MessageShape.prototype = new mxCylinder();
	MessageShape.prototype.constructor = MessageShape;
	MessageShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		if (isForeground)
		{
			path.moveTo(0, 0);
			path.lineTo(w / 2, h / 2);
			path.lineTo(w, 0);
			path.end();
		}
		else
		{
			path.moveTo(0, 0);
			path.lineTo(w, 0);
			path.lineTo(w, h);
			path.lineTo(0, h);
			path.close();
		}
	};

	mxCellRenderer.prototype.defaultShapes['message'] = MessageShape;
	
	// New Actor Shape
	function UmlActorShape() { };
	UmlActorShape.prototype = new mxCylinder();
	UmlActorShape.prototype.constructor = UmlActorShape;
	UmlActorShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var width = w / 3;
		var height = h / 4;
		
		if (!isForeground)
		{
			path.moveTo(w / 2, height);
			path.curveTo(w / 2 - width, height, w / 2 - width, 0, w / 2, 0);
			path.curveTo(w / 2 + width, 0, w / 2 + width, height, w / 2, height);
			path.close();
		}
		else
		{
			path.moveTo(w / 2, height);
			path.lineTo(w / 2, 2 * h / 3);
			
			// Arms
			path.moveTo(w / 2, h / 3);
			path.lineTo(0, h / 3);
			path.moveTo(w / 2, h / 3);
			path.lineTo(w, h / 3);
			
			// Legs
			path.moveTo(w / 2, 2 * h / 3);
			path.lineTo(0, h);
			path.moveTo(w / 2, 2 * h / 3);
			path.lineTo(w, h);
			path.end();
		}
	};

	// Replaces existing actor shape
	mxCellRenderer.prototype.defaultShapes['umlActor'] = UmlActorShape;

	// New Actor Shape
	function LollipopShape() { };
	LollipopShape.prototype = new mxCylinder();
	LollipopShape.prototype.constructor = LollipopShape;
	LollipopShape.prototype.size = 10;
	LollipopShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var ss = this.scale * mxUtils.getValue(this.style, 'size', this.size);
		var width = ss * 2 / 3;
		var height = ss;
		
		if (!isForeground)
		{
			path.moveTo(w / 2, height);
			path.curveTo(w / 2 - width, height, w / 2 - width, 0, w / 2, 0);
			path.curveTo(w / 2 + width, 0, w / 2 + width, height, w / 2, height);
			path.close();
		}
		else
		{
			path.moveTo(w / 2, height);
			path.lineTo(w / 2, h);
			path.end();
		}
	};

	// Replaces existing actor shape
	mxCellRenderer.prototype.defaultShapes['lollipop'] = LollipopShape;
	
	// Folder Shape, supports tabWidth, tabHeight styles
	function ComponentShape() { };
	ComponentShape.prototype = new mxCylinder();
	ComponentShape.prototype.constructor = ComponentShape;
	ComponentShape.prototype.jettyWidth = 32;
	ComponentShape.prototype.jettyHeight = 12;
	ComponentShape.prototype.redrawPath = function(path, x, y, w, h, isForeground)
	{
		var jw = mxUtils.getValue(this.style, 'jettyWidth', this.jettyWidth);
		var jh = mxUtils.getValue(this.style, 'jettyHeight', this.jettyHeight);
		var dx = jw * this.scale;
		var dy = jh * this.scale;
		var x0 = dx / 2;
		var x1 = x0 + dx / 2;
		var y0 = 0.3 * h - dy / 2;
		var y1 = 0.7 * h - dy / 2;

		if (isForeground)
		{
			path.moveTo(x0, y0);
			path.lineTo(x1, y0);
			path.lineTo(x1, y0 + dy);
			path.lineTo(x0, y0 + dy);
			path.moveTo(x0, y1);
			path.lineTo(x1, y1);
			path.lineTo(x1, y1 + dy);
			path.lineTo(x0, y1 + dy);
			path.end();
		}
		else
		{
			path.moveTo(x0, 0);
			path.lineTo(w, 0);
			path.lineTo(w, h);
			path.lineTo(x0, h);
			path.lineTo(x0, y1 + dy);
			path.lineTo(0, y1 + dy);
			path.lineTo(0, y1);
			path.lineTo(x0, y1);
			path.lineTo(x0, y0 + dy);
			path.lineTo(0, y0 + dy);
			path.lineTo(0, y0);
			path.lineTo(x0, y0);
			path.close();
			path.end();
		}
	};

	mxCellRenderer.prototype.defaultShapes['component'] = ComponentShape;
	
	// State Shapes derives from double ellipse
	function StateShape() { };
	StateShape.prototype = new mxDoubleEllipse();
	StateShape.prototype.constructor = StateShape;
	StateShape.prototype.outerStroke = true;
	StateShape.prototype.createSvg = function()
	{
		var g = mxDoubleEllipse.prototype.createSvg.apply(this, arguments);
		this.foreground.setAttribute('fill', this.innerNode.getAttribute('fill'));
		this.foreground.setAttribute('stroke', this.stroke);
		this.innerNode.setAttribute('fill', 'none');
		this.innerNode.setAttribute('stroke', (this.outerStroke) ? this.stroke : 'none');
		
		return g;
	};
	StateShape.prototype.redrawSvg = function()
	{
		mxDoubleEllipse.prototype.redrawSvg.apply(this, arguments);
		
		// Workaround for visible background
		this.innerNode.setAttribute('fill', 'none');
		
		if (this.shadowNode != null)
		{
			this.shadowNode.setAttribute('cx', this.foreground.getAttribute('cx'));
			this.shadowNode.setAttribute('cy', this.foreground.getAttribute('cy'));
			this.shadowNode.setAttribute('rx', this.foreground.getAttribute('rx'));
			this.shadowNode.setAttribute('ry', this.foreground.getAttribute('ry'));
		}
	};
	StateShape.prototype.createVml = function()
	{
		var result = mxDoubleEllipse.prototype.createVml.apply(this, arguments);
		
		if (this.fillNode != null)
		{
			this.foreground.appendChild(this.fillNode);
			this.foreground.filled = 'true';
		}
		
		this.background.filled = 'false';
		this.background.stroked = (this.outerStroke) ? 'true' : 'false';
		
		if (this.shadowNode != null)
		{
			this.foreground.appendChild(this.shadowNode);
		}
		
		return result;
	};

	mxCellRenderer.prototype.defaultShapes['endState'] = StateShape;

	function StartStateShape() { };
	StartStateShape.prototype = new StateShape();
	StartStateShape.prototype.constructor = StartStateShape;
	StartStateShape.prototype.outerStroke = false;
	
	mxCellRenderer.prototype.defaultShapes['startState'] = StartStateShape;

	// Image export for state shapes
	var imageExportInitShapes = mxImageExport.prototype.initShapes;
	mxImageExport.prototype.initShapes = function()
	{
		imageExportInitShapes.apply(this, arguments);

		function createStateShape(outerStroke)
		{
			return {
				drawShape: function(canvas, state, bounds, background)
				{
					var x = bounds.x;
					var y = bounds.y;
					var w = bounds.width;
					var h = bounds.height;
					
					if (background)
					{
						var inset = Math.min(4, Math.min(w / 5, h / 5));
						x += inset;
						y += inset;
						w -= 2 * inset;
						h -= 2 * inset;
						
						if (w > 0 && h > 0)
						{
							canvas.ellipse(x, y, w, h);
						}
						
						return true;
					}
					else
					{
						canvas.fillAndStroke();
		
						if (outerStroke)
						{
							canvas.ellipse(x, y, w, h);
							canvas.stroke();
						}
					}
				}
			};
		};
		
		this.shapes['endState'] = createStateShape(true);
		this.shapes['startState'] = createStateShape(false);
	};

	// Custom edge shape
	function LinkShape() { };
	LinkShape.prototype = new mxArrow();
	LinkShape.prototype.constructor = LinkShape;
	LinkShape.prototype.enableFill = false;
	LinkShape.prototype.addPipe = true;
	
	LinkShape.prototype.redrawPath = function(path, x, y, w, h)
	{
		// All points are offset
		path.translate.x -= x;
		path.translate.y -= y;

		// Geometry of arrow
		var width = 10 * this.scale;

		// Base vector (between end points)
		var p0 = this.points[0];
		var pe = this.points[this.points.length - 1];
		
		var dx = pe.x - p0.x;
		var dy = pe.y - p0.y;
		var dist = Math.sqrt(dx * dx + dy * dy);
		var length = dist;
		
		// Computes the norm and the inverse norm
		var nx = dx / dist;
		var ny = dy / dist;
		var basex = length * nx;
		var basey = length * ny;
		var floorx = width * ny/3;
		var floory = -width * nx/3;
		
		// Computes points
		var p0x = p0.x - floorx / 2;
		var p0y = p0.y - floory / 2;
		var p1x = p0x + floorx;
		var p1y = p0y + floory;
		var p2x = p1x + basex;
		var p2y = p1y + basey;
		var p3x = p2x + floorx;
		var p3y = p2y + floory;
		// p4 not needed
		var p5x = p3x - 3 * floorx;
		var p5y = p3y - 3 * floory;
		
		// LATER: Add support for n points
		path.moveTo(p1x, p1y);
		path.lineTo(p2x, p2y);
		path.moveTo(p5x + floorx, p5y + floory);
		path.lineTo(p0x, p0y);
		path.end();
	};

	mxCellRenderer.prototype.defaultShapes['link'] = LinkShape;
	
	// Defines custom marker
	mxMarker.markers['dash'] = function(node, type, pe, nx, ny, strokewidth, size, scale, isVml)
	{
		nx = nx * (size + strokewidth);
		ny = ny * (size + strokewidth);
		
		if (isVml)
		{
			node.setAttribute('path', 'm' + Math.floor(pe.x - nx / 2- ny / 2) + ' ' + Math.floor(pe.y - ny / 2 + nx / 2) +
				' l ' + Math.floor(pe.x + ny / 2 - 3 * nx / 2) + ' ' + Math.floor(pe.y - 3 * ny / 2 - nx / 2) +
				' e');
		}
		else
		{
			node.setAttribute('d', 'M ' + (pe.x - nx / 2 - ny / 2) + ' ' + (pe.y - ny / 2 + nx / 2) +
					' L ' + (pe.x + ny / 2 - 3 * nx / 2) + ' ' + (pe.y - 3 * ny / 2 - nx / 2) +
					' z');
		}
		
		// Returns the offset for the edge
		return new mxPoint(0, 0);
	};

	// Registers the marker in mxImageExport
	var mxImageExportInitMarkers = mxImageExport.prototype.initMarkers;
	mxImageExport.prototype.initMarkers = function()
	{
		mxImageExportInitMarkers.apply(this, arguments);
		
		this.markers['dash'] = function(canvas, state, type, pe, unitX, unitY, size, source, sw)
		{
			nx = unitX * (size + sw);
			ny = unitY * (size + sw);
			
			canvas.begin();
			canvas.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
			canvas.lineTo(pe.x + ny / 2 - 3 * nx / 2, pe.y - 3 * ny / 2 - nx / 2);
			canvas.stroke();
			
			// Returns the offset for the edge
			return new mxPoint(0, 0);
		};
	};

	// Enables crisp rendering in SVG except for connectors, actors, cylinder,
	// ellipses must be enabled after rendering the sidebar items
	mxShape.prototype.crisp = true;
	mxShape.prototype.roundedCrispSvg = false;
	mxActor.prototype.crisp = false;
	mxCylinder.prototype.crisp = false;
	mxEllipse.prototype.crisp = false;
	mxDoubleEllipse.prototype.crisp = false;
	mxConnector.prototype.crisp = false;
	FolderShape.prototype.crisp = true;
	ComponentShape.prototype.crisp = true;
})();

